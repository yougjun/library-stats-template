import logging
from dataclasses import dataclass, field
from typing import List

logger = logging.getLogger(__name__)


@dataclass
class Chunk:
    content: str
    metadata: dict = field(default_factory=dict)


def chunk_keyword_reference(keyword_ref: dict) -> List[Chunk]:
    chunks = []
    for category, items in keyword_ref.items():
        lines = [f"[용어 사전] 카테고리: {category}"]
        for key, synonyms in items.items():
            if isinstance(synonyms, list):
                lines.append(f"- {key}: {', '.join(str(s) for s in synonyms)}")
            else:
                lines.append(f"- {key}: {synonyms}")
        chunks.append(Chunk(
            content="\n".join(lines),
            metadata={"source": "keyword_reference", "category": category},
        ))
    return chunks


def chunk_room_mappings(room_map: dict) -> List[Chunk]:
    chunks = []
    grouped: dict[str, list] = {}
    for term, codes in room_map.items():
        key = ",".join(sorted(codes))
        grouped.setdefault(key, []).append(term)

    for codes_key, terms in grouped.items():
        codes = codes_key.split(",")
        content = (
            f"[자료실 매핑] 자료실 코드: {', '.join(codes)}\n"
            f"이 자료실을 가리키는 용어들: {', '.join(terms)}"
        )
        chunks.append(Chunk(
            content=content,
            metadata={"source": "room_mappings", "room_codes": codes_key},
        ))
    return chunks


def chunk_room_classification(room_class: dict) -> List[Chunk]:
    chunks = []
    for floor_key, floor_data in room_class.items():
        title = floor_data.get("title", floor_key)
        rooms = floor_data.get("rooms", {})
        for room_name, room_info in rooms.items():
            codes = room_info.get("codes", [])
            desc = room_info.get("description", "")
            note = room_info.get("note", "")
            content = (
                f"[자료실 분류] {title} > {room_name}\n"
                f"자료실 코드: {', '.join(str(c) for c in codes)}\n"
                f"설명: {desc}"
            )
            if note:
                content += f"\n참고: {note}"
            chunks.append(Chunk(
                content=content,
                metadata={"source": "room_classification", "floor": floor_key, "room": room_name},
            ))
    return chunks


def chunk_stat_keyword_map(stat_map: dict) -> List[Chunk]:
    chunks = []
    for stat_type, info in stat_map.items():
        keywords = info.get("keywords", [])
        table = info.get("table", "")
        source = info.get("source", "")
        total_calc = info.get("total_calculation", "")

        lines = [
            f"[통계 유형] {stat_type}",
            f"관련 키워드: {', '.join(keywords)}",
            f"DB 테이블: {table}",
            f"데이터 출처: {source}",
        ]
        if total_calc:
            lines.append(f"합계 계산식: {total_calc}")

        fields = info.get("fields", {})
        if fields:
            lines.append("포함 항목:")
            for field_key, field_info in fields.items():
                name = field_info.get("name", field_key)
                calc = field_info.get("calculation", "")
                field_kws = field_info.get("keywords", [])
                line = f"  - {name}"
                if field_kws:
                    line += f" (키워드: {', '.join(field_kws)})"
                if calc:
                    line += f" | 계산: {calc}"
                lines.append(line)

                sub_fields = field_info.get("sub_fields", {})
                if sub_fields:
                    for sf_key, sf_info in sub_fields.items():
                        sf_name = sf_info.get("name", sf_key)
                        sf_source = sf_info.get("source", "")
                        sf_calc = sf_info.get("calculation", "")
                        sf_note = sf_info.get("note", "")
                        sf_line = f"    · {sf_name}: 출처={sf_source}"
                        if sf_calc:
                            sf_line += f", 계산={sf_calc}"
                        if sf_note:
                            sf_line += f", 참고={sf_note}"
                        lines.append(sf_line)

        categories = info.get("categories", {})
        if categories:
            lines.append("서비스/공간:")
            for cat_key, cat_info in categories.items():
                cat_name = cat_info.get("name", cat_key)
                cat_floor = cat_info.get("floor", "")
                lines.append(f"  - {cat_name} ({cat_floor})")

        chunks.append(Chunk(
            content="\n".join(lines),
            metadata={"source": "stat_keyword_map", "stat_type": stat_type, "table": table},
        ))
    return chunks


def chunk_data_source_knowledge(ds_knowledge: dict) -> List[Chunk]:
    chunks = []
    for ds_key, ds_info in ds_knowledge.items():
        name = ds_info.get("name", ds_key)
        desc = ds_info.get("description", "")
        automation = ds_info.get("automation", "")
        age_mapping = ds_info.get("age_mapping", "")

        lines = [f"[데이터 출처] {name}"]
        if desc:
            lines.append(f"설명: {desc}")
        if automation:
            lines.append(f"자동화: {automation}")
        if age_mapping:
            lines.append(f"연령 매핑: {age_mapping}")

        fields = ds_info.get("fields", {})
        if fields:
            lines.append("필드 상세:")
            for f_key, f_info in fields.items():
                f_name = f_info.get("name", f_key)
                f_source = f_info.get("source", "")
                f_path = f_info.get("path", "")
                f_calc = f_info.get("calculation", "")
                f_note = f_info.get("note", "")
                f_auto = f_info.get("automation", "")
                line = f"  - {f_name}"
                if f_source:
                    line += f" | 출처: {f_source}"
                if f_path:
                    line += f" | 경로: {f_path}"
                if f_calc:
                    line += f" | 계산: {f_calc}"
                if f_auto:
                    line += f" | 방식: {f_auto}"
                if f_note:
                    line += f" | 참고: {f_note}"
                lines.append(line)

        cat_map = ds_info.get("category_mapping", {})
        if cat_map:
            lines.append("카테고리 매핑:")
            for cat, codes in cat_map.items():
                lines.append(f"  - {cat}: {codes}")

        chunks.append(Chunk(
            content="\n".join(lines),
            metadata={"source": "data_source_knowledge", "data_source": ds_key},
        ))
    return chunks


def chunk_db_schema(models_info: List[dict]) -> List[Chunk]:
    chunks = []
    for model_info in models_info:
        table = model_info["table"]
        description = model_info["description"]
        columns = model_info["columns"]

        lines = [
            f"[DB 테이블] {table}",
            f"설명: {description}",
            "컬럼:",
        ]
        for col in columns:
            lines.append(f"  - {col['name']} ({col['type']}): {col.get('description', '')}")

        chunks.append(Chunk(
            content="\n".join(lines),
            metadata={"source": "db_schema", "table": table},
        ))
    return chunks


def chunk_document(content: str, filename: str, chunk_size: int = 500, overlap: int = 50) -> List[Chunk]:
    chunks = []
    text = content.strip()
    if not text:
        return chunks

    start = 0
    idx = 0
    while start < len(text):
        end = start + chunk_size
        chunk_text = text[start:end]
        if end < len(text):
            last_newline = chunk_text.rfind("\n")
            last_period = chunk_text.rfind(".")
            break_at = max(last_newline, last_period)
            if break_at > chunk_size * 0.3:
                chunk_text = chunk_text[: break_at + 1]
                end = start + break_at + 1

        chunks.append(Chunk(
            content=chunk_text.strip(),
            metadata={"source": "uploaded_document", "filename": filename, "chunk_index": idx},
        ))
        start = end - overlap
        idx += 1

    return chunks
