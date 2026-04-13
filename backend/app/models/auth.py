"""
Auth Models — User accounts, access codes, site passwords, and remember-me tokens.
These tables manage authentication state for both site-level and role-based access.
"""

from sqlalchemy import Column, Integer, String, Boolean, TIMESTAMP
from sqlalchemy.sql import func

from app.models.base import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    name = Column(String(100))
    created_at = Column(TIMESTAMP, server_default=func.now())


class AccessCode(Base):
    __tablename__ = "access_codes"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100))
    role = Column(String(20), nullable=False)
    description = Column(String(200))
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    expires_at = Column(TIMESTAMP)


class SitePassword(Base):
    __tablename__ = "site_password"
    id = Column(Integer, primary_key=True, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    updated_by = Column(String(50))


class RememberToken(Base):
    __tablename__ = "remember_tokens"
    id = Column(Integer, primary_key=True, index=True)
    selector = Column(String(32), unique=True, nullable=False, index=True)
    hashed_validator = Column(String(64), nullable=False)
    device_name = Column(String(255))
    access_type = Column(String(50), nullable=False)
    access_role = Column(String(50))
    access_code = Column(String(50))
    last_used = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    created_at = Column(TIMESTAMP, server_default=func.now())
    expires_at = Column(TIMESTAMP)
