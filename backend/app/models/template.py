"""
Template Models — Generic template-driven data storage.
TemplateConfig stores analyzed Excel template structure and Univer editor JSON.
CellData stores per-cell values keyed by template, sheet, cell ref, and month.
"""

from sqlalchemy import Column, Integer, String, Boolean, JSON, TIMESTAMP, Index, ForeignKey
from sqlalchemy.sql import func

from app.models.base import Base


class TemplateConfig(Base):
    __tablename__ = "template_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    template_type = Column(String(20), nullable=False)
    structure = Column(JSON, nullable=False)
    cell_roles = Column(JSON, default={})
    univer_data = Column(JSON)
    file_hash = Column(String(64))
    original_filename = Column(String(200))
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


class CellData(Base):
    __tablename__ = "cell_data"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("template_configs.id"), nullable=False)
    sheet_name = Column(String(100), nullable=False)
    cell_ref = Column(String(10), nullable=False)
    year_month = Column(String(7), nullable=False)
    value = Column(String(500))
    value_type = Column(String(10), default="number")
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    updated_by = Column(String(50))

    __table_args__ = (
        Index(
            "ix_celldata_lookup",
            "template_id", "year_month", "sheet_name", "cell_ref",
            unique=True,
        ),
    )
