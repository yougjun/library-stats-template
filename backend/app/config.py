"""
Application Configuration — Centralized environment-based settings.
All environment variables are loaded here and exposed as typed attributes.
Other modules import from this single source instead of calling os.getenv() directly.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


class Config:
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_HOURS: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "24"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    CSRF_SECRET: str = os.getenv("CSRF_SECRET", "")
    LOCAL_API_KEY: str = os.getenv("LOCAL_API_KEY", "")

    # CORS
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")

    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # IP Whitelist
    ALLOWED_IPS: list[str] = (
        os.getenv("ALLOWED_IPS", "").split(",") if os.getenv("ALLOWED_IPS") else []
    )
    IP_WHITELIST_ENABLED: bool = os.getenv("IP_WHITELIST_ENABLED", "false").lower() == "true"

    # Paths
    TEMPLATE_PATH: str = os.getenv(
        "TEMPLATE_PATH",
        str(BASE_DIR / "template" / "template.xlsx"),
    )
    LOG_DIR: Path = BASE_DIR / "logs"

    # AI / External APIs
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "gemini")

    # RAG / ChromaDB
    CHROMADB_PATH: str = os.getenv("CHROMADB_PATH", str(BASE_DIR / "data" / "chromadb"))

    # Library identity (customizable per deployment)
    LIBRARY_NAME: str = os.getenv("LIBRARY_NAME", "My Library")
    TEMPLATE_FILENAME: str = os.getenv("TEMPLATE_FILENAME", "library_statistics.xlsx")

    @classmethod
    def validate(cls) -> list[str]:
        required = ["DATABASE_URL", "SECRET_KEY", "LOCAL_API_KEY", "CORS_ORIGINS", "CSRF_SECRET"]
        missing = [var for var in required if not getattr(cls, var)]
        return missing

    @classmethod
    def is_production(cls) -> bool:
        return cls.ENVIRONMENT == "production"

    @classmethod
    def is_development(cls) -> bool:
        return cls.ENVIRONMENT == "development"


config = Config()
