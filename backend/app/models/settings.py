"""
Settings Models — Application configuration stored in the database.
Settings holds key-value pairs (holidays, multipliers, feature flags).
MultiplierHistory tracks reading multiplier changes over time.
AutomationExclusion marks months excluded from auto-calculation.
"""

from sqlalchemy import Column, Integer, String, Float, TIMESTAMP, JSON, Index
from sqlalchemy.sql import func

from app.models.base import Base


class Settings(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False)
    value = Column(JSON, nullable=False)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    updated_by = Column(String(50))


class MultiplierHistory(Base):
    __tablename__ = "multiplier_history"
    id = Column(Integer, primary_key=True, index=True)
    floor = Column(String(10), nullable=False)
    multiplier = Column(Float, nullable=False)
    effective_from = Column(String(7), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    created_by = Column(String(50))
    __table_args__ = (
        Index('ix_multiplier_history_floor_effective', 'floor', 'effective_from'),
    )


class AutomationExclusion(Base):
    __tablename__ = "automation_exclusions"
    id = Column(Integer, primary_key=True, index=True)
    year_month = Column(String(7), nullable=False)
    floor = Column(String(20), nullable=False)
    reason = Column(String(200))
    created_at = Column(TIMESTAMP, server_default=func.now())
    created_by = Column(String(50))
