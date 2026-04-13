"""
Chat Routes — Conversational AI endpoints for library statistics queries.
"""

import os
import asyncio
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.dependencies import get_db
from app import models, schemas

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("", response_model=schemas.ChatResponse)
@limiter.limit("10/minute")
async def chat_with_ai(
    request: Request,
    data: schemas.ChatRequest,
    db: Session = Depends(get_db)
):
    from app.services.chat.service import get_chat_response

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: get_chat_response(data.message, db, data.session_id)
    )
    return schemas.ChatResponse(
        response=result["response"],
        session_id=result["session_id"],
        has_chart_data=result.get("chart_data") is not None,
        chart_data=result.get("chart_data"),
        suggestions=result.get("suggestions", []),
        typo_corrections=result.get("typo_corrections", []),
        intent=result.get("intent"),
        confidence=result.get("confidence")
    )


@router.post("/feedback")
async def submit_chat_feedback(request: Request, data: dict, db: Session = Depends(get_db)):
    return {"status": "feedback_received"}


@router.get("/history/{session_id}")
async def get_chat_history(session_id: str, limit: int = 50, db: Session = Depends(get_db)):
    history = db.query(models.ChatHistory).filter(
        models.ChatHistory.session_id == session_id
    ).order_by(models.ChatHistory.created_at.desc()).limit(limit).all()

    return [
        {
            "user_message": h.user_message,
            "bot_response": h.bot_response,
            "intent": h.intent,
            "created_at": h.created_at.isoformat() if h.created_at else None
        }
        for h in reversed(history)
    ]


@router.get("/chart")
async def get_chart_data(
    chart_type: str,
    year: str = None,
    month1: str = None,
    month2: str = None,
    db: Session = Depends(get_db)
):
    if year is None:
        year = str(datetime.now().year)

    return {"error": "Chart data requires template-driven data configuration", "chart_data": None}


@router.get("/analytics")
async def get_chat_analytics(days: int = 7, db: Session = Depends(get_db)):
    since = datetime.now() - timedelta(days=days)

    total = db.query(sql_func.count(models.ChatHistory.id)).filter(
        models.ChatHistory.created_at >= since
    ).scalar()

    intent_stats = db.query(
        models.ChatHistory.intent,
        sql_func.count(models.ChatHistory.id)
    ).filter(
        models.ChatHistory.created_at >= since,
        models.ChatHistory.intent.isnot(None)
    ).group_by(models.ChatHistory.intent).all()

    avg_time = db.query(sql_func.avg(models.ChatHistory.response_time_ms)).filter(
        models.ChatHistory.created_at >= since,
        models.ChatHistory.response_time_ms.isnot(None)
    ).scalar()

    daily_counts = db.query(
        sql_func.date(models.ChatHistory.created_at),
        sql_func.count(models.ChatHistory.id)
    ).filter(
        models.ChatHistory.created_at >= since
    ).group_by(sql_func.date(models.ChatHistory.created_at)).all()

    return {
        "total_messages": total or 0,
        "intent_distribution": {intent: count for intent, count in intent_stats},
        "avg_response_time_ms": round(avg_time or 0, 2),
        "daily_counts": {str(date): count for date, count in daily_counts}
    }


ALLOWED_UPLOAD_TYPES = {
    "application/pdf", "text/plain", "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@router.post("/documents")
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if file.content_type not in ALLOWED_UPLOAD_TYPES and not file.filename.endswith((".pdf", ".txt", ".md")):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    from app.services.rag.document_service import index_document
    result = index_document(db, file.filename, file_bytes, file.content_type)

    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/documents")
async def list_documents(db: Session = Depends(get_db)):
    from app.services.rag.document_service import list_documents
    return list_documents(db)


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: int, db: Session = Depends(get_db)):
    from app.services.rag.document_service import delete_document
    result = delete_document(db, doc_id)
    if result["status"] == "not_found":
        raise HTTPException(status_code=404, detail="Document not found")
    return result


@router.post("/reindex")
async def reindex_knowledge_base():
    from app.services.rag.indexer import index_knowledge_base
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, lambda: index_knowledge_base(reset=True))
    return result
