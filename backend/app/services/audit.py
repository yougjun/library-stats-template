"""
Audit Logger — Captures before-snapshots of data for change tracking.
"""

from sqlalchemy.orm import Session
from datetime import datetime

from app import models


def log_page_snapshot(db: Session, page_type: str, year_month: str, snapshot_data: dict, changed_by: str):
    audit_entry = models.AuditLog(
        page_type=page_type,
        year_month=year_month,
        snapshot_data=snapshot_data,
        changed_by=changed_by
    )
    db.add(audit_entry)


def serialize_list(obj_list):
    result = []
    for obj in obj_list:
        item = {}
        for column in obj.__table__.columns:
            value = getattr(obj, column.name)
            if isinstance(value, datetime):
                item[column.name] = value.isoformat()
            else:
                item[column.name] = value
        result.append(item)
    return result
