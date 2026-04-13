"""
Chat Service Package -- Korean-language library statistics chatbot.

Main entry points:
    get_chat_response   - Process a user message and return a structured response.
    cleanup_session     - Remove an in-memory session after disconnect.

NLU helpers (used internally, but available for diagnostics):
    analyze_query       - Run the full NLU pipeline on a raw question.
    preload_models      - Warm up embedding / classifier models at startup.
"""

from app.services.chat.service import get_chat_response, cleanup_session
from app.services.chat.nlu import analyze_query, preload_models

__all__ = [
    "get_chat_response",
    "cleanup_session",
    "analyze_query",
    "preload_models",
]
