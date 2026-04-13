import logging
from typing import List, Optional

from app.services.rag.retriever import RetrievedChunk

logger = logging.getLogger(__name__)

MAX_CONTEXT_CHARS = 3000


def build_prompt(
    question: str,
    chunks: List[RetrievedChunk],
    parsed_context: Optional[dict] = None,
    db_data: Optional[str] = None,
) -> str:
    sections = []

    if chunks:
        context_parts = []
        total_len = 0
        for i, chunk in enumerate(chunks, 1):
            entry = f"[참고 {i}] ({chunk.metadata.get('source', 'unknown')})\n{chunk.content}"
            if total_len + len(entry) > MAX_CONTEXT_CHARS:
                break
            context_parts.append(entry)
            total_len += len(entry)
        sections.append("=== 관련 컨텍스트 ===\n" + "\n\n".join(context_parts))

    if db_data:
        sections.append(f"=== 데이터베이스 조회 결과 ===\n{db_data}")

    if parsed_context:
        ctx_parts = []
        if parsed_context.get("year"):
            ctx_parts.append(f"연도: {parsed_context['year']}")
        if parsed_context.get("month"):
            ctx_parts.append(f"월: {parsed_context['month']}")
        if parsed_context.get("floor"):
            ctx_parts.append(f"층: {parsed_context['floor']}")
        if parsed_context.get("program"):
            ctx_parts.append(f"프로그램: {parsed_context['program']}")
        if parsed_context.get("stat_type"):
            ctx_parts.append(f"통계유형: {parsed_context['stat_type']}")
        if ctx_parts:
            sections.append("=== 파싱된 쿼리 정보 ===\n" + ", ".join(ctx_parts))

    sections.append(f"=== 사용자 질문 ===\n{question}")
    sections.append("위 컨텍스트를 참고하여 질문에 답변하세요.")

    return "\n\n".join(sections)
