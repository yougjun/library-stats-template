"""
Main chat service orchestrator.
Receives user messages, routes through the NLU pipeline, resolves
follow-up queries via session context, queries the database through
the knowledge layer, and returns enhanced responses with suggestions
and optional chart data.
"""
import os
import sys
import logging
import hashlib
import re
import json
import uuid
import time
from datetime import datetime, timedelta
from typing import Optional, Tuple, Dict, Any, List
from sqlalchemy.orm import Session as DBSession

from app.config import Config
from app.services.chat.smart import preprocess_message, enhance_response, detect_correction, apply_correction
from app import models

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', 'nlu_training'))
try:
    from inference import get_nlu, analyze as koelectra_analyze
    from persistent_learning import log_interaction
except ImportError:
    koelectra_analyze = None
    log_interaction = None

logger = logging.getLogger(__name__)

_session_contexts = {}
CONTEXT_TTL = timedelta(minutes=10)
MAX_SESSIONS = 1000

_cache = {}
CACHE_TTL = timedelta(minutes=10)
MAX_CACHE_SIZE = 100


def _get_cache_key(message: str) -> str:
    return hashlib.md5(message.strip().lower().encode()).hexdigest()


def _get_cached(key: str) -> str | None:
    if key in _cache:
        response, timestamp = _cache[key]
        if datetime.now() - timestamp < CACHE_TTL:
            return response
        del _cache[key]
    return None


def _set_cache(key: str, response: str):
    if len(_cache) >= MAX_CACHE_SIZE:
        oldest = min(_cache, key=lambda k: _cache[k][1])
        del _cache[oldest]
    _cache[key] = (response, datetime.now())


def _is_followup_query(message: str) -> bool:
    """Detect if message is a follow-up to previous query."""
    message = message.strip()

    if re.search(r'^(그럼\s*|그러면\s*)?(\d{1,2})월(은|도|요|이요)?\??$', message):
        return True

    if re.search(r'^(인원|횟수|권수|명수)(은|는|도|요|이요)?\??$', message):
        return True

    if re.search(r'^(\d{4}년\s*)?추이(\s*보기)?\??$', message):
        return True

    if re.search(r'^전월대비\??$', message):
        return True

    if re.search(r'^(책꾸러미|동화체험|책봇|에어프로젝션)(은|는|도|요)?\??$', message):
        return True

    if message in ["그럼", "그러면", "그리고", "또", "다른", "비교", "비교해줘", "비교해", "전월대비"]:
        return True

    return False


def _get_or_create_session(session_id: Optional[str], db: DBSession = None) -> str:
    """Get existing session or create new one."""
    if session_id and session_id in _session_contexts:
        ctx = _session_contexts[session_id]
        if datetime.now() - ctx["last_time"] < CONTEXT_TTL:
            return session_id

    if session_id and db:
        try:
            db_session = db.query(models.ChatSession).filter(
                models.ChatSession.id == session_id
            ).first()
            if db_session:
                parsed = None
                if db_session.context_json:
                    try:
                        parsed = json.loads(db_session.context_json)
                    except (json.JSONDecodeError, TypeError):
                        pass
                _session_contexts[session_id] = {
                    "last_query": None,
                    "last_parsed": parsed,
                    "last_time": datetime.now(),
                }
                logger.info(f"Restored session {session_id} from DB")
                return session_id
        except Exception as e:
            logger.warning(f"Failed to load session from DB: {e}")

    new_session_id = session_id or str(uuid.uuid4())

    if len(_session_contexts) >= MAX_SESSIONS:
        oldest = min(_session_contexts, key=lambda k: _session_contexts[k]["last_time"])
        del _session_contexts[oldest]

    _session_contexts[new_session_id] = {
        "last_query": None,
        "last_parsed": None,
        "last_time": datetime.now(),
    }

    if db:
        try:
            existing = db.query(models.ChatSession).filter(
                models.ChatSession.id == new_session_id
            ).first()
            if not existing:
                db_session = models.ChatSession(id=new_session_id)
                db.add(db_session)
                db.commit()
        except Exception as e:
            logger.warning(f"Failed to save session to DB: {e}")
            db.rollback()

    return new_session_id


def cleanup_session(session_id: str):
    """Remove session from memory cache."""
    if session_id in _session_contexts:
        del _session_contexts[session_id]
        logger.debug(f"Cleaned up session {session_id}")


def _get_context(session_id: str) -> Optional[dict]:
    """Get conversation context for session if still valid."""
    if session_id not in _session_contexts:
        return None
    ctx = _session_contexts[session_id]
    if ctx["last_parsed"] is None:
        return None
    if datetime.now() - ctx["last_time"] > CONTEXT_TTL:
        return None
    return ctx["last_parsed"]


def _save_context(session_id: str, query: str, parsed: dict, db: DBSession = None):
    """Save successful query context for session."""
    if session_id not in _session_contexts:
        _session_contexts[session_id] = {}

    _session_contexts[session_id]["last_query"] = query
    _session_contexts[session_id]["last_parsed"] = parsed
    _session_contexts[session_id]["last_time"] = datetime.now()

    if db:
        try:
            db_session = db.query(models.ChatSession).filter(
                models.ChatSession.id == session_id
            ).first()
            if db_session:
                db_session.context_json = json.dumps(parsed, ensure_ascii=False, default=str)
                db_session.last_active = datetime.now()
                db.commit()
        except Exception as e:
            logger.warning(f"Failed to update session context in DB: {e}")
            db.rollback()


def _save_chat_history(
    db: DBSession,
    session_id: str,
    user_message: str,
    bot_response: str,
    intent: str = None,
    confidence: float = None,
    parsed_context: dict = None,
    response_time_ms: int = None
):
    """Save chat exchange to database."""
    if not db:
        return
    try:
        history = models.ChatHistory(
            session_id=session_id,
            user_message=user_message,
            bot_response=bot_response,
            intent=intent,
            confidence=confidence,
            parsed_context=json.dumps(parsed_context, ensure_ascii=False, default=str) if parsed_context else None,
            response_time_ms=response_time_ms,
        )
        db.add(history)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to save chat history: {e}")
        db.rollback()


def _merge_with_context(message: str, context: dict) -> str:
    """Merge follow-up message with previous context to form complete query."""
    message = message.strip()

    year = context.get("year", datetime.now().strftime("%Y"))
    month = context.get("month")

    if re.search(r'추이(\s*보기)?', message):
        parts = []
        year_match = re.search(r'(\d{4})년', message)
        if year_match:
            parts.append(f"{year_match.group(1)}년")
        else:
            parts.append(f"{year}년")

        if context.get("program_korean"):
            parts.append(context["program_korean"])
        elif context.get("stat_type") == "ai_library":
            parts.append("AI도서관")
        elif context.get("stat_type") == "material":
            parts.append("자료이용")

        parts.append("추이")
        merged = " ".join(parts)
        logger.info(f"Merged follow-up '{message}' with context to: '{merged}'")
        return merged

    if "전월대비" in message:
        parts = []
        if year and month:
            parts.append(f"{year}년 {int(month)}월")
        else:
            parts.append(f"{year}년 {datetime.now().month}월")

        if context.get("program_korean"):
            parts.append(context["program_korean"])
        elif context.get("stat_type") == "ai_library":
            parts.append("AI도서관")
        elif context.get("stat_type") == "material":
            parts.append("자료이용")

        parts.append("전월대비")
        merged = " ".join(parts)
        logger.info(f"Merged follow-up '{message}' with context to: '{merged}'")
        return merged

    program_match = re.search(r'^(책꾸러미|동화체험|책봇|에어프로젝션)(은|는|도|요)?\??$', message)
    if program_match:
        program = program_match.group(1)
        parts = []
        if year and month:
            parts.append(f"{year}년 {int(month)}월")
        parts.append(program)
        parts.append("현황")
        merged = " ".join(parts)
        logger.info(f"Merged follow-up '{message}' with context to: '{merged}'")
        return merged

    month_match = re.search(r'(\d{1,2})월', message)
    if month_match:
        new_month = month_match.group(1)
        parts = []
        parts.append(f"{year}년")
        parts.append(f"{new_month}월")

        if context.get("stat_type") == "ai_library":
            parts.append("AI도서관 현황")
        elif context.get("stat_type") == "regular_member":
            parts.append("정회원 현황")
        elif context.get("stat_type") == "material":
            parts.append("자료 이용 현황")
        elif context.get("program_korean"):
            parts.append(context["program_korean"])
        elif context.get("program"):
            prog_map = {
                "book_package": "책꾸러미",
                "storytelling": "동화체험",
                "library_tour": "도서관나들이",
                "english_book_club": "영어북클럽",
                "room_event": "자료실행사",
            }
            parts.append(prog_map.get(context["program"], context["program"]))
        else:
            parts.append("이용자 현황")

        if context.get("detail_type"):
            detail = context["detail_type"]
            if isinstance(detail, list):
                detail_map = {"session_count": "횟수", "participant_count": "인원", "book_count": "권수"}
                detail_parts = [detail_map.get(d, d) for d in detail]
                parts.append("와 ".join(detail_parts))
            else:
                detail_map = {"session_count": "횟수", "participant_count": "인원", "book_count": "권수"}
                parts.append(detail_map.get(detail, detail))

        if context.get("section") and not context.get("program") and not context.get("stat_type"):
            if context.get("section_name"):
                parts.append(context["section_name"])

        merged = " ".join(parts)
        logger.info(f"Merged follow-up '{message}' with context to: '{merged}'")
        return merged

    detail_match = re.search(r'(인원|횟수|권수)', message)
    if detail_match and context.get("year_month"):
        parts = [f"{year}년 {int(month)}월"]
        if context.get("program_korean"):
            parts.append(context["program_korean"])
        parts.append(detail_match.group(1))
        merged = " ".join(parts)
        logger.info(f"Merged follow-up '{message}' with context to: '{merged}'")
        return merged

    return message


def _try_db_answer(db: DBSession, question: str) -> Optional[str]:
    """Try to answer from database first."""
    try:
        from app.services.chat.knowledge import answer_stats_question
        return answer_stats_question(db, question)
    except Exception as e:
        logger.error(f"DB query failed: {e}")
        return None


def _try_rag_answer(message: str, nlu_context: dict = None, parsed_context: dict = None) -> Optional[str]:
    try:
        import asyncio
        from app.services.rag.rag_service import rag_answer
        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(rag_answer(message, parsed_context=parsed_context))
        finally:
            loop.close()
        if result and result.get("response"):
            logger.info(f"RAG answer from {result.get('model', '?')}, chunks={result.get('chunks_used', 0)}")
            return result["response"]
    except Exception as e:
        logger.warning(f"RAG fallback failed: {e}")
    return None


def _generate_local_response(message: str, nlu_context: dict = None) -> str:
    """Generate response using local KoELECTRA model (no API cost)."""
    try:
        if koelectra_analyze is None:
            return "질문을 처리하는 중 오류가 발생했습니다. 다시 시도해주세요."

        result = koelectra_analyze(message)
        intent = result.get("intent", "query_stats")
        slots = result.get("slots", {})
        confidence = result.get("confidence", 0.5)

        logger.info(f"KoELECTRA: intent={intent}, slots={slots}, conf={confidence:.2f}")

        year = slots.get("YEAR", str(datetime.now().year))
        month = slots.get("MONTH")
        floor = slots.get("FLOOR")
        room = slots.get("ROOM")
        program = slots.get("PROGRAM")
        equipment = slots.get("EQUIPMENT")

        if intent == "help":
            return _get_help_response()

        if intent == "greeting":
            return f"안녕하세요! {Config.LIBRARY_NAME} 통계 챗봇입니다. 무엇을 도와드릴까요?\n\n예시: '2025년 11월 이용자수', '책꾸러미 현황', 'AI도서관 이용자'"

        if intent == "explain":
            if equipment:
                equipment_formulas = {
                    "bookbot": "책봇 이용자 = 로미 이용횟수 (자동수집)",
                    "air_projection": "에어프로젝션 = 이용횟수 (자동수집)",
                    "finger_story": "핑거스토리 = 이용횟수 (자동수집)",
                    "ar_book": "AR북 = 이용횟수 (자동수집)",
                }
                return equipment_formulas.get(equipment, "해당 장비의 계산 방법 정보가 없습니다.")
            if program:
                return f"{program} 계산 방법: 횟수와 인원은 수동 입력된 데이터를 사용합니다."
            return "**계산 공식**\n- 열람 = 대출 x 배율\n- 이용자 = 대출 + 열람\n- 배율은 설정에서 변경 가능합니다."

        if intent == "list":
            return """**조회 가능 항목**
- 이용자 현황 (층별, 자료실별)
- 자료 이용 현황 (대출, 열람)
- 프로그램: 책꾸러미, 동화체험, 도서관나들이, 영어북클럽
- AI도서관: 책봇, 에어프로젝션, 핑거스토리, AR북
- 정회원 현황
- 비교 분석 (전월대비, 전년대비)"""

        if intent == "input_guide":
            if floor == "1":
                return "**1층 입력 방법**: 대출 데이터는 KLAS에서 자동수집, 프로그램(책꾸러미, 동화체험)은 수동입력"
            if floor in ["2", "3"]:
                return "**2-3층 입력 방법**: 대출 데이터는 KLAS에서 자동수집, 프로그램(책바다, 책나래)은 수동입력"
            return "**입력 방법**: KLAS 데이터(대출)는 자동수집, 프로그램 횟수/인원은 수동입력"

        if intent == "keyword_reference":
            return """**키워드 목록**
- 자료실: 어린이자료실, 유아자료실, 종합자료실, 인문예술자료실
- 프로그램: 책꾸러미, 동화체험, 도서관나들이, 영어북클럽
- AI장비: 책봇(로미), 에어프로젝션, 핑거스토리, AR북
- 분류: 총류, 철학, 종교, 사회과학, 자연과학, 기술과학, 예술, 언어, 문학, 역사"""

        if intent == "query_byeolchi":
            return """**별치기호 목록**
- A: 아동도서, Y: 청소년도서, R: 참고도서
- M: 만화, E: 영어도서, K: 한국학
- L: 대활자본, B: 점자도서"""

        time_str = ""
        if year and month:
            time_str = f"{year}년 {month}월"
        elif year:
            time_str = f"{year}년"

        location_str = ""
        if floor:
            location_str = f"{floor}층"
        if room:
            location_str = room

        if intent == "query_ai" or equipment:
            equip_name = equipment or "AI도서관"
            equip_names = {"bookbot": "책봇", "air_projection": "에어프로젝션", "finger_story": "핑거스토리", "ar_book": "AR북"}
            equip_korean = equip_names.get(equipment, equip_name)
            return f"'{time_str} {equip_korean} 현황'으로 다시 질문해주세요. 정확한 데이터 조회를 위해 년월 정보가 필요합니다."

        if intent == "query_program" or program:
            prog_name = program or "프로그램"
            return f"'{time_str} {prog_name} 현황'으로 다시 질문해주세요. 정확한 데이터 조회를 위해 년월 정보가 필요합니다."

        if intent == "query_material":
            return f"'{time_str} {location_str} 자료 이용 현황'으로 다시 질문해주세요."

        if intent == "query_cumulative":
            return f"'{year}년 이용자 누계' 또는 '{year}년 {location_str} 누계'로 다시 질문해주세요."

        if intent == "query_trend":
            return f"'{year}년 추이' 또는 '{year}년 {program or location_str or '이용자'} 추이'로 다시 질문해주세요."

        if intent == "compare":
            return f"'{time_str} 전월대비' 또는 '{time_str} 전년대비'로 다시 질문해주세요."

        if intent in ["query_stats", "query_material"]:
            if time_str:
                return f"'{time_str} {location_str} 이용자 현황'의 데이터를 찾을 수 없습니다. 질문을 다시 확인해주세요."
            return "년월 정보를 포함하여 질문해주세요. 예: '2025년 11월 이용자수'"

        return f"질문을 이해하지 못했습니다. 도움말을 보려면 '도움말' 또는 '사용법'을 입력해주세요."

    except Exception as e:
        logger.error(f"Local response generation failed: {e}")
        return "질문을 처리하는 중 오류가 발생했습니다. 다시 시도해주세요."


def _analyze_with_nlu(question: str) -> Optional[dict]:
    """Analyze question with NLU module (v2)."""
    try:
        from app.services.chat.nlu import analyze_query
        return analyze_query(question)
    except Exception as e:
        logger.warning(f"NLU v2 analysis failed: {e}")
        return None


def _get_help_response() -> str:
    """Return help message."""
    library_name = Config.LIBRARY_NAME
    return f"""**{library_name} 통계 챗봇 사용법**

**월별 통계 조회** (년월 필수)
- "2025년 11월 이용자수"
- "2025년 11월 어린이자료실 현황"
- "2025년 11월 정회원 현황"

**누계 조회** (년도만 입력)
- "2025년 이용자 누계"
- "2025년 책꾸러미 누계"
- "2025년 3층 이용자 누계"

**자료 이용 현황**
- "2025년 11월 자료 이용 현황"
- "2025년 자료 이용 누계"

**프로그램**
- "2025년 11월 책꾸러미 현황"
- "2025년 11월 동화체험 횟수와 인원"
- "책꾸러미 계산 방법"

**AI 도서관**
- "2025년 11월 AI도서관 현황"
- "2025년 11월 책봇 이용자"

**비교 분석**
- "2025년 11월 전월대비 이용자"
- "2025년 11월 전년대비"

**자료실 분류/코드**
- "어린이자료실 자료실 코드"
- "2층 자료실 분류"
- "3층 자료실 분류"

**계산 방법/출처**
- "열람 계산 방법"
- "에어프로젝션 계산 공식"
- "책꾸러미 횟수 계산 방법"

**키워드/별치기호**
- "키워드 목록"
- "별치기호 목록"

**입력 방법 안내**
- "1층 입력 방법"
- "정회원 입력 방법"
- "뭘 수동으로 입력해야 해요?"
"""


def _determine_comparison_stat_type(question: str, parsed: dict) -> str:
    """Determine which stat type to compare based on query keywords."""
    q = question.lower()

    if any(k in question for k in ["정회원", "회원수", "회원 수"]):
        return "regular_member"
    if any(k in question for k in ["책꾸러미", "동화체험", "프로그램", "book_package", "storytelling"]):
        return "program"
    if any(k in question for k in ["책봇", "에어프로젝션", "핑거스토리", "AR북", "AI도서관", "ai도서관"]):
        return "ai_library"
    if any(k in question for k in ["자료이용", "대출", "열람", "주제별"]):
        return "material"
    if any(k in question for k in ["1일출입증", "출입증", "day pass", "데이패스"]):
        return "day_pass"

    if parsed.get("program"):
        return "program"
    if parsed.get("query_type") == "regular_member":
        return "regular_member"
    if parsed.get("stat_type"):
        return parsed["stat_type"]

    return "visitor"


def _get_unit_for_stat_type(stat_type: str) -> str:
    """Get appropriate unit suffix for stat type."""
    if stat_type in ["visitor", "regular_member", "program", "ai_library", "day_pass"]:
        return "명"
    if stat_type == "material":
        return "권"
    return ""


def _get_compare_response(db: DBSession, question: str, context: dict = None) -> Optional[str]:
    """Handle comparison queries for all data types."""
    try:
        from app.services.chat.knowledge import (
            parse_query, get_universal_comparison_data, format_comparison_response
        )
        parsed = parse_query(question)

        if not parsed.get("compare_type") or not parsed.get("year_month"):
            if context and question.strip() in ["비교", "비교해줘", "비교해"]:
                year = context.get("year")
                month = context.get("month")
                if year and month:
                    parsed["year_month"] = f"{year}-{int(month):02d}"
                    parsed["compare_type"] = "prev_month"
                    parsed["stat_type"] = context.get("stat_type")
                    parsed["query_type"] = context.get("query_type")
                else:
                    return None
            else:
                return None

        stat_type = _determine_comparison_stat_type(question, parsed)

        program_name = None
        program_korean = None
        if stat_type == "program":
            if "책꾸러미" in question:
                program_name = "book_package"
                program_korean = "책꾸러미"
            elif "동화체험" in question:
                program_name = "storytelling"
                program_korean = "동화체험"
            elif "영어동화" in question:
                program_name = "english_story"
                program_korean = "영어동화"
            elif parsed.get("program"):
                program_name = parsed.get("program")
                program_korean = parsed.get("program_korean", program_name)

        comparison = get_universal_comparison_data(
            db=db,
            year_month=parsed["year_month"],
            compare_type=parsed["compare_type"],
            stat_type=stat_type,
            floor=parsed.get("floor"),
            program_name=program_name,
            room_types=parsed.get("room_types"),
            category=parsed.get("category"),
            compare_month=parsed.get("compare_month")
        )

        if not comparison:
            return None

        unit = _get_unit_for_stat_type(stat_type)
        return format_comparison_response(comparison, program_korean, unit)

    except Exception as e:
        logger.warning(f"Compare response failed: {e}")
        return None


def get_chat_response(
    user_message: str,
    db: DBSession = None,
    session_id: str = None
) -> Dict[str, Any]:
    """
    Main entry point for chat with NLU pipeline.

    Returns: {
        response: str,
        session_id: str,
        chart_data: dict | None,
        suggestions: List[str],
        typo_corrections: List[str]
    }

    Flow:
    1. Get or create session
    2. Smart preprocessing (typos, references, corrections)
    3. Check for follow-up queries and merge with context
    4. Check cache
    5. NLU Analysis (Intent + Semantic Similarity)
    6. Route based on intent
    7. Enhance response (suggestions, auto-chart)
    8. Save context and history
    9. Return enhanced response
    """
    start_time = time.time()
    result = {
        "response": "",
        "session_id": session_id or "",
        "chart_data": None,
        "suggestions": [],
        "typo_corrections": [],
        "intent": None,
        "confidence": None,
    }

    if not user_message or not user_message.strip():
        result["response"] = "메시지를 입력해주세요."
        return result

    session_id = _get_or_create_session(session_id, db)
    result["session_id"] = session_id

    context = _get_context(session_id)

    original_message = user_message
    processed_message, preprocess_meta = preprocess_message(user_message, context)
    if preprocess_meta.get("typo_corrections"):
        result["typo_corrections"] = preprocess_meta["typo_corrections"]
        logger.info(f"Typos corrected: {preprocess_meta['typo_corrections']}")
    if preprocess_meta.get("correction_applied"):
        user_message = processed_message
        logger.info(f"Correction applied: '{original_message}' -> '{user_message}'")
    elif preprocess_meta.get("reference_resolved"):
        user_message = processed_message
        logger.info(f"Reference resolved: '{original_message}' -> '{user_message}'")
    else:
        user_message = processed_message

    if _is_followup_query(original_message) and context:
        user_message = _merge_with_context(user_message, context)
        logger.info(f"Follow-up merged: '{original_message}' -> '{user_message}'")

    cache_key = _get_cache_key(user_message)
    cached = _get_cached(cache_key)
    if cached:
        logger.info(f"Cache hit for: {user_message[:30]}")
        try:
            from app.services.chat.knowledge import parse_query, detect_stat_type
            parsed = parse_query(user_message)
            detected = detect_stat_type(user_message)
            if detected.get("stat_type"):
                parsed["stat_type"] = detected["stat_type"]
            _save_context(session_id, user_message, parsed, db)
        except Exception as e:
            logger.warning(f"Failed to save context on cache hit: {e}")
        result["response"] = cached
        return result

    nlu_result = _analyze_with_nlu(user_message)
    intent = None
    confidence = None
    parsed = None

    compare_keywords = ["전월대비", "전년대비", "전월 대비", "전년 대비", "비교", "대비"]
    is_explicit_compare = any(kw in user_message for kw in compare_keywords)

    if is_explicit_compare and db:
        compare_response = _get_compare_response(db, user_message, context)
        if compare_response:
            _set_cache(cache_key, compare_response)
            result["response"] = compare_response
            return result

    if db:
        from app.services.chat.knowledge import parse_query
        parsed_flags = parse_query(user_message)
        if parsed_flags.get("ask_rooms") or parsed_flags.get("ask_source") or parsed_flags.get("ask_byeolchi"):
            db_answer = _try_db_answer(db, user_message)
            if db_answer:
                logger.info(f"Parser priority: rooms={parsed_flags.get('ask_rooms')}, source={parsed_flags.get('ask_source')}, byeolchi={parsed_flags.get('ask_byeolchi')}")
                _set_cache(cache_key, db_answer)
                result["response"] = db_answer
                try:
                    from app.services.chat.knowledge import detect_stat_type
                    detected = detect_stat_type(user_message)
                    if detected.get("stat_type"):
                        parsed_flags["stat_type"] = detected["stat_type"]
                    _save_context(session_id, user_message, parsed_flags, db)
                except Exception as e:
                    logger.warning(f"Failed to save context: {e}")
                return result

    if nlu_result:
        intent = nlu_result["intent"]
        confidence = nlu_result["final_confidence"]
        result["intent"] = intent
        result["confidence"] = confidence
        logger.info(f"NLU: intent={intent}, confidence={confidence:.2f}")

        if nlu_result["needs_clarification"] and confidence < 0.4:
            if not _is_followup_query(original_message):
                from app.services.chat.nlu import get_clarification_question
                clarify = get_clarification_question(nlu_result)
                if clarify:
                    result["response"] = clarify
                    return result

        if intent == "help":
            response = _get_help_response()
            _set_cache(cache_key, response)
            result["response"] = response
            return result

        if intent == "compare":
            compare_response = _get_compare_response(db, user_message, context)
            if compare_response:
                _set_cache(cache_key, compare_response)
                result["response"] = compare_response
                return result

    db_answer = None
    if db:
        db_answer = _try_db_answer(db, user_message)
        logger.info(f"DB answer: {'Found' if db_answer else 'None'} for: {user_message[:30]}")

    if db_answer:
        response = db_answer
        try:
            from app.services.chat.knowledge import parse_query, detect_stat_type
            parsed = parse_query(user_message)
            detected = detect_stat_type(user_message)
            if detected.get("stat_type"):
                stat_type = detected["stat_type"]
                if stat_type == "material_usage":
                    stat_type = "material"
                parsed["stat_type"] = stat_type
            elif parsed.get("query_type") == "material_usage":
                parsed["stat_type"] = "material"
            _save_context(session_id, user_message, parsed, db)
            logger.debug(f"Saved context: year={parsed.get('year')}, month={parsed.get('month')}, program={parsed.get('program')}, stat_type={parsed.get('stat_type')}")
        except Exception as e:
            logger.warning(f"Failed to save context: {e}")
    else:
        rag_result = _try_rag_answer(user_message, nlu_result, parsed or context)
        if rag_result:
            response = rag_result
        else:
            response = _generate_local_response(user_message, nlu_result)

    enhanced = enhance_response(response, parsed or context or {}, db)
    result["response"] = enhanced["response"]
    result["suggestions"] = enhanced.get("suggestions", [])

    if enhanced.get("chart_type") and db:
        try:
            from app.services.chat.knowledge import get_chart_data
            chart_params = enhanced.get("chart_params", {})
            chart_params["chart_type"] = enhanced["chart_type"]
            result["chart_data"] = get_chart_data(db, enhanced["chart_type"], chart_params)
        except Exception as e:
            logger.warning(f"Failed to get chart data: {e}")

    response_time_ms = int((time.time() - start_time) * 1000)

    _save_chat_history(
        db=db,
        session_id=session_id,
        user_message=original_message,
        bot_response=result["response"],
        intent=intent,
        confidence=confidence,
        parsed_context=parsed,
        response_time_ms=response_time_ms
    )

    try:
        if log_interaction is not None:
            response_type = "success" if db_answer else "fallback"
            log_interaction(
                user_query=user_message,
                predicted_intent=intent or "unknown",
                confidence=confidence or 0.5,
                entities=parsed or {},
                response_type=response_type
            )
    except Exception as e:
        logger.debug(f"Persistent learning log failed: {e}")

    _set_cache(cache_key, result["response"])
    return result
