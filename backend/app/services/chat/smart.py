"""
Smart NLU enhancements — Generic stub.

Floor-specific typo dictionaries, SQL queries, and Korean-language
processing have been removed. These stub functions maintain API
compatibility with the chat service orchestrator.
"""

import logging
from typing import Optional, Dict, List, Tuple

logger = logging.getLogger(__name__)


def preprocess_message(message: str, context: Optional[dict] = None) -> dict:
    return {
        "original": message,
        "processed": message,
        "corrections": [],
        "references_resolved": False,
    }


def enhance_response(response: str, context: Optional[dict] = None, db=None) -> dict:
    return {
        "response": response,
        "suggestions": [],
        "include_chart": False,
        "chart_type": None,
        "insight": None,
    }


def detect_correction(message: str, context: Optional[dict] = None) -> Optional[dict]:
    return None


def apply_correction(correction: dict, context: dict) -> str:
    return correction.get("query", "")


def fix_typos(message: str) -> Tuple[str, List[str]]:
    return message, []
