"""
NLU (Natural Language Understanding) — Generic intent classification stub.

Floor-specific intent keywords and Korean semantic templates have been removed.
The system now uses a simplified intent classifier suitable for template-driven
data queries. For advanced NLU, integrate an LLM provider via the RAG system.
"""

import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

INTENTS = {
    "query_stats": {
        "keywords": ["statistics", "stats", "data", "count", "total", "how many"],
        "description": "Query statistical data",
    },
    "help": {
        "keywords": ["help", "how", "what can", "guide"],
        "description": "Request help or guidance",
    },
    "greeting": {
        "keywords": ["hello", "hi", "hey", "good morning", "good afternoon"],
        "description": "Greeting",
    },
}


def classify_intent(message: str) -> Tuple[str, float]:
    message_lower = message.lower()
    for intent_name, intent_data in INTENTS.items():
        for keyword in intent_data["keywords"]:
            if keyword in message_lower:
                return intent_name, 0.8
    return "help", 0.3


def analyze_query(message: str, context: Optional[dict] = None) -> dict:
    intent, confidence = classify_intent(message)
    return {
        "intent": intent,
        "confidence": confidence,
        "params": {},
        "original_message": message,
    }


def get_clarification_question(intent: str, confidence: float) -> str:
    return "Could you please be more specific about what data you're looking for?"


def preload_models():
    logger.info("[preload_models] NLU models ready (generic stub)")
