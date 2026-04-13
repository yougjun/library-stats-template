"""
Shared Dependencies — Common FastAPI dependencies used across routes.
Provides DB session, auth verification, and input validation helpers.
"""

import re
from fastapi import HTTPException, Request
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from app.models.base import SessionLocal
from app.config import config


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def validate_year_month(year_month: str) -> str:
    if not re.match(r'^\d{4}-\d{2}$', year_month):
        raise HTTPException(status_code=400, detail="Invalid year_month format")
    year, month = map(int, year_month.split('-'))
    if not (1 <= month <= 12):
        raise HTTPException(status_code=400, detail="Invalid year_month format")
    return year_month


def verify_any_token(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = auth_header[7:]
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
        token_type = payload.get("token_type", "access")
        if token_type != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def format_changed_by(token_data: dict) -> str:
    code = token_data.get("code", "unknown")
    role = token_data.get("role", "")
    if role:
        return f"{code} ({role})"
    return code
