import logging
import hashlib
from typing import List

from app.services.rag.chromadb_store import ChromaDBStore
from app.services.rag.chunker import (
    Chunk,
    chunk_db_schema,
)
from app.services.rag.config import COLLECTION_KNOWLEDGE, COLLECTION_SCHEMA

logger = logging.getLogger(__name__)


def _make_id(prefix: str, content: str) -> str:
    h = hashlib.md5(content.encode()).hexdigest()[:12]
    return f"{prefix}_{h}"


def _collect_knowledge_chunks() -> List[Chunk]:
    return []


def _collect_schema_chunks() -> List[Chunk]:
    models_info = [
        {
            "table": "template_config",
            "description": "Template configuration — uploaded Excel templates and their metadata",
            "columns": [
                {"name": "id", "type": "Integer", "description": "Primary key"},
                {"name": "name", "type": "String", "description": "Template name"},
                {"name": "file_path", "type": "String", "description": "Path to template file"},
            ],
        },
        {
            "table": "cell_data",
            "description": "Template-driven cell data — user-entered values mapped to template cells",
            "columns": [
                {"name": "id", "type": "Integer", "description": "Primary key"},
                {"name": "year_month", "type": "String(7)", "description": "Target month (e.g., 2025-11)"},
                {"name": "field_id", "type": "String", "description": "Field identifier from field catalog"},
                {"name": "value", "type": "Text", "description": "Entered value"},
            ],
        },
        {
            "table": "settings",
            "description": "System settings — key-value configuration store",
            "columns": [
                {"name": "key", "type": "String(50)", "description": "Setting key"},
                {"name": "value", "type": "Text", "description": "Setting value (JSON)"},
            ],
        },
    ]
    return chunk_db_schema(models_info)


def index_knowledge_base(reset: bool = False) -> dict:
    store = ChromaDBStore()

    if reset:
        store.reset_collection(COLLECTION_KNOWLEDGE)
        store.reset_collection(COLLECTION_SCHEMA)

    knowledge_chunks = _collect_knowledge_chunks()
    schema_chunks = _collect_schema_chunks()

    k_count = 0
    if knowledge_chunks:
        k_docs = [c.content for c in knowledge_chunks]
        k_metas = [c.metadata for c in knowledge_chunks]
        k_ids = [_make_id("kb", c.content) for c in knowledge_chunks]
        k_count = store.add_documents(COLLECTION_KNOWLEDGE, k_docs, k_metas, k_ids)

    s_docs = [c.content for c in schema_chunks]
    s_metas = [c.metadata for c in schema_chunks]
    s_ids = [_make_id("schema", c.content) for c in schema_chunks]
    s_count = store.add_documents(COLLECTION_SCHEMA, s_docs, s_metas, s_ids)

    result = {
        "knowledge_chunks": k_count,
        "schema_chunks": s_count,
        "total": k_count + s_count,
    }
    logger.info(f"Indexing complete: {result}")
    return result
