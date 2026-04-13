"""
Chat Schemas — Request/response models for the conversational AI endpoints.
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str
    has_chart_data: bool = False
    chart_data: Optional[dict] = None
    suggestions: List[str] = []
    typo_corrections: List[str] = []
    intent: Optional[str] = None
    confidence: Optional[float] = None


class ChatHistoryItem(BaseModel):
    user_message: str
    bot_response: str
    intent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
