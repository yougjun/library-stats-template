import logging
import hashlib
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.services.rag.chromadb_store import ChromaDBStore
from app.services.rag.chunker import chunk_document, Chunk
from app.services.rag.config import COLLECTION_DOCUMENTS
from app.models.chat import IndexedDocument

logger = logging.getLogger(__name__)


def _file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()[:16]


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    import fitz
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()
    return "\n\n".join(pages)


def _extract_text(file_bytes: bytes, content_type: str, filename: str) -> str:
    if content_type == "application/pdf" or filename.lower().endswith(".pdf"):
        return _extract_text_from_pdf(file_bytes)
    return file_bytes.decode("utf-8", errors="replace")


def index_document(
    db: Session,
    filename: str,
    file_bytes: bytes,
    content_type: str,
) -> dict:
    fhash = _file_hash(file_bytes)

    existing = db.query(IndexedDocument).filter(IndexedDocument.file_hash == fhash).first()
    if existing:
        return {"status": "duplicate", "filename": existing.filename, "id": existing.id}

    text = _extract_text(file_bytes, content_type, filename)
    if not text.strip():
        return {"status": "error", "message": "No text content extracted"}

    chunks = chunk_document(text, filename)
    if not chunks:
        return {"status": "error", "message": "No chunks generated"}

    store = ChromaDBStore()
    docs = [c.content for c in chunks]
    metas = [c.metadata for c in chunks]
    ids = [f"doc_{fhash}_{i}" for i in range(len(chunks))]
    store.add_documents(COLLECTION_DOCUMENTS, docs, metas, ids)

    record = IndexedDocument(
        filename=filename,
        content_type=content_type,
        chunk_count=len(chunks),
        file_hash=fhash,
        indexed_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    logger.info(f"Indexed document '{filename}': {len(chunks)} chunks, hash={fhash}")
    return {"status": "ok", "id": record.id, "chunks": len(chunks), "filename": filename}


def list_documents(db: Session) -> list:
    docs = db.query(IndexedDocument).order_by(IndexedDocument.indexed_at.desc()).all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "content_type": d.content_type,
            "chunk_count": d.chunk_count,
            "indexed_at": d.indexed_at.isoformat() if d.indexed_at else None,
        }
        for d in docs
    ]


def delete_document(db: Session, doc_id: int) -> dict:
    record = db.query(IndexedDocument).filter(IndexedDocument.id == doc_id).first()
    if not record:
        return {"status": "not_found"}

    store = ChromaDBStore()
    store.delete_by_metadata(COLLECTION_DOCUMENTS, {"filename": record.filename})

    db.delete(record)
    db.commit()

    logger.info(f"Deleted document id={doc_id}, filename={record.filename}")
    return {"status": "ok", "filename": record.filename}
