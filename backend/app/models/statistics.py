"""
Statistics Models — Monthly base periods, raw age statistics, and audit logs.
MonthlyBase tracks the work period for each month (start/end dates, workdays).
RawAgeStatistics stores per-age lending breakdowns imported from KLAS.
AuditLog captures before-snapshots for change tracking.
"""

from sqlalchemy import Column, Integer, String, Boolean, TIMESTAMP, Date, JSON, Float, Text, Index
from sqlalchemy.sql import func

from app.models.base import Base


class MonthlyBase(Base):
    __tablename__ = "monthly_base"
    id = Column(Integer, primary_key=True, index=True)
    year_month = Column(String(7), unique=True, nullable=False)
    workdays = Column(Integer)
    start_date = Column(Date)
    end_date = Column(Date)
    is_completed = Column(Boolean, nullable=True)
    last_updated = Column(TIMESTAMP, server_default=func.now())
    updated_by = Column(String(50))


class RawAgeStatistics(Base):
    __tablename__ = "raw_age_statistics"
    id = Column(Integer, primary_key=True, index=True)
    year_month = Column(String(7), nullable=False)
    floor = Column(String(10), nullable=False)
    room_code = Column(String(10), nullable=False)
    room_name = Column(String(100), nullable=False)
    age = Column(String(30), nullable=False)
    subject_000 = Column(Integer, default=0)
    subject_100 = Column(Integer, default=0)
    subject_200 = Column(Integer, default=0)
    subject_300 = Column(Integer, default=0)
    subject_400 = Column(Integer, default=0)
    subject_500 = Column(Integer, default=0)
    subject_600 = Column(Integer, default=0)
    subject_700 = Column(Integer, default=0)
    subject_800 = Column(Integer, default=0)
    subject_900 = Column(Integer, default=0)
    total = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    updated_by = Column(String(50))
    __table_args__ = (
        Index('idx_raw_age_stats_query', 'year_month', 'floor', 'room_code', 'age'),
        Index('idx_raw_age_stats_floor', 'floor', 'year_month'),
    )


class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True, index=True)
    page_type = Column(String(50), nullable=False)
    year_month = Column(String(7), nullable=False)
    snapshot_data = Column(JSON, nullable=False)
    changed_by = Column(String(50))
    changed_at = Column(TIMESTAMP, server_default=func.now())
