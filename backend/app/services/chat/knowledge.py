"""
Chat Knowledge Service — Generic knowledge base stub.

Floor-specific knowledge maps have been removed. The system now relies on
RAG (document-based retrieval) for domain knowledge. These stub functions
maintain API compatibility with the chat service orchestrator.
"""

import logging
from sqlalchemy.orm import Session
from datetime import datetime

logger = logging.getLogger(__name__)


def get_current_year() -> str:
    return datetime.now().strftime("%Y")


def get_current_month() -> int:
    return datetime.now().month


def parse_query(message: str) -> dict:
    return {
        "year": get_current_year(),
        "month": None,
        "floor": None,
        "stat_type": None,
        "program_name": None,
    }


def detect_stat_type(message: str) -> str | None:
    return None


def answer_stats_question(db: Session, intent: str, params: dict, **kwargs) -> str:
    return (
        "Statistics queries require template-driven data configuration. "
        "Please upload documents via the RAG system for AI-powered answers."
    )


def get_chart_data(db: Session, chart_type: str, params: dict) -> dict | None:
    return None


def get_keyword_reference() -> str:
    return "No keyword reference available. Configure template-driven data to enable queries."


def get_input_guide() -> str:
    return "Use the template-driven input page to enter and manage your data."
