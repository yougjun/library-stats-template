"""
Device Service — Remember-me token management using secure selector+validator pattern.
Selector is stored in plain text for lookup; validator is hashed for verification.
Tokens auto-expire after REMEMBER_DURATION_DAYS.
"""

import secrets
import hashlib
import random
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
import logging

from app import models
from app.services.auth import create_access_token

logger = logging.getLogger(__name__)

REMEMBER_DURATION_DAYS = 30
COOKIE_NAME = "remember_token"
MAX_TOKENS_PER_USER = 5
SELECTOR_LENGTH = 32
VALIDATOR_LENGTH = 64


def generate_selector() -> str:
    return secrets.token_hex(16)


def generate_validator() -> str:
    return secrets.token_hex(32)


def hash_validator(validator: str) -> str:
    return hashlib.sha256(validator.encode()).hexdigest()


def create_cookie_value(selector: str, validator: str) -> str:
    return f"{selector}:{validator}"


def parse_cookie_value(cookie: str) -> tuple[str, str] | None:
    if not cookie or ":" not in cookie:
        return None
    parts = cookie.split(":", 1)
    if len(parts) != 2:
        return None
    selector, validator = parts[0], parts[1]
    if len(selector) != SELECTOR_LENGTH or len(validator) != VALIDATOR_LENGTH:
        return None
    if not all(c in '0123456789abcdef' for c in selector):
        return None
    if not all(c in '0123456789abcdef' for c in validator):
        return None
    return selector, validator


class RememberTokenService:

    @staticmethod
    def verify_token(db: Session, cookie_value: str) -> Dict[str, Any]:
        if random.random() < 0.01:
            RememberTokenService.cleanup_expired(db)

        parsed = parse_cookie_value(cookie_value)
        if not parsed:
            return {"trusted": False}

        selector, validator = parsed

        token = db.query(models.RememberToken).filter(
            models.RememberToken.selector == selector
        ).first()

        if not token:
            return {"trusted": False}

        if token.expires_at and token.expires_at < datetime.now():
            db.delete(token)
            db.commit()
            logger.info(f"Expired token removed: {selector[:8]}...")
            return {"trusted": False}

        expected_hash = token.hashed_validator
        actual_hash = hash_validator(validator)
        if not secrets.compare_digest(expected_hash, actual_hash):
            db.delete(token)
            db.commit()
            logger.warning(f"Invalid validator, token deleted: {selector[:8]}...")
            return {"trusted": False}

        token.last_used = datetime.now()
        db.commit()

        access_token = RememberTokenService._generate_access_token(token)

        return {
            "trusted": True,
            "access_type": token.access_type,
            "access_role": token.access_role,
            "token": access_token
        }

    @staticmethod
    def create_token(
        db: Session,
        access_type: str,
        access_role: Optional[str] = None,
        access_code: Optional[str] = None,
        device_name: Optional[str] = None
    ) -> Dict[str, Any]:
        if access_type == "edit" and not access_role:
            raise ValueError("access_role required for edit access")

        existing_count = db.query(models.RememberToken).filter(
            models.RememberToken.access_type == access_type,
            models.RememberToken.access_role == access_role if access_role else True
        ).count()

        if existing_count >= MAX_TOKENS_PER_USER:
            oldest = db.query(models.RememberToken).filter(
                models.RememberToken.access_type == access_type,
                models.RememberToken.access_role == access_role if access_role else True
            ).order_by(models.RememberToken.last_used.asc()).first()
            if oldest:
                db.delete(oldest)
                db.commit()
                logger.info("Removed oldest token to make room for new one")

        selector = generate_selector()
        validator = generate_validator()
        hashed = hash_validator(validator)
        expires_at = datetime.now() + timedelta(days=REMEMBER_DURATION_DAYS)

        token = models.RememberToken(
            selector=selector,
            hashed_validator=hashed,
            device_name=device_name,
            access_type=access_type,
            access_role=access_role,
            access_code=access_code,
            expires_at=expires_at
        )
        db.add(token)
        db.commit()

        cookie_value = create_cookie_value(selector, validator)
        logger.info(f"Token created: {device_name or 'Unknown'} ({access_type})")

        return {
            "success": True,
            "cookie_value": cookie_value,
            "max_age": REMEMBER_DURATION_DAYS * 24 * 60 * 60
        }

    @staticmethod
    def revoke_token(db: Session, cookie_value: str) -> Dict[str, Any]:
        parsed = parse_cookie_value(cookie_value)
        if not parsed:
            return {"success": True, "message": "No valid token to revoke"}

        selector, _ = parsed
        token = db.query(models.RememberToken).filter(
            models.RememberToken.selector == selector
        ).first()

        if not token:
            return {"success": True, "message": "Token already revoked"}

        db.delete(token)
        db.commit()
        logger.info(f"Token revoked: {selector[:8]}...")
        return {"success": True}

    @staticmethod
    def cleanup_expired(db: Session) -> int:
        expired = db.query(models.RememberToken).filter(
            models.RememberToken.expires_at < datetime.now()
        ).all()
        count = len(expired)
        for token in expired:
            db.delete(token)
        if count > 0:
            db.commit()
            logger.info(f"Cleaned up {count} expired tokens")
        return count

    @staticmethod
    def _generate_access_token(token: models.RememberToken) -> Optional[str]:
        if token.access_type == "site":
            return create_access_token({"type": "site_access"})
        elif token.access_type == "edit":
            return create_access_token({
                "role": token.access_role,
                "code": token.access_code or token.access_role
            })
        return None
