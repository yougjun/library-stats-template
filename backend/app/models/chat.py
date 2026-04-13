"""
Chat Models — Conversational AI session and history storage.
ChatSession tracks active conversations; ChatHistory stores the full
message exchange with intent classification and response timing.
"""

from sqlalchemy import Column, Integer, String, Float, Text, TIMESTAMP, ForeignKey, Index
from sqlalchemy.sql import func

from app.models.base import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(String(36), primary_key=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    last_active = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    context_json = Column(Text, nullable=True)
    __table_args__ = (
        Index('idx_chat_session_active', 'last_active'),
    )


class ChatHistory(Base):
    __tablename__ = "chat_history"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), ForeignKey('chat_sessions.id'), nullable=False)
    user_message = Column(Text, nullable=False)
    bot_response = Column(Text, nullable=False)
    intent = Column(String(50), nullable=True)
    confidence = Column(Float, nullable=True)
    parsed_context = Column(Text, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    __table_args__ = (
        Index('idx_chat_history_session', 'session_id', 'created_at'),
        Index('idx_chat_history_intent', 'intent'),
    )


class IndexedDocument(Base):
    __tablename__ = "indexed_documents"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=True)
    chunk_count = Column(Integer, default=0)
    file_hash = Column(String(16), nullable=False, unique=True)
    indexed_at = Column(TIMESTAMP, server_default=func.now())
