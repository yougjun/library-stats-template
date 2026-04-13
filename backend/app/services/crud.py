"""
CRUD Factory — Generic upsert operations for bulk and single-record saves.
Provides reusable insert-or-update logic with optimistic locking via WITH FOR UPDATE.
"""

from typing import Type, List, Callable, Any
from sqlalchemy.orm import Session
from sqlalchemy.ext.declarative import DeclarativeMeta
from sqlalchemy import exc
from fastapi import HTTPException
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)


def generic_upsert(
    db: Session,
    model_class: Type[DeclarativeMeta],
    year_month: str,
    data: List[Any],
    unique_fields: List[str],
    updated_by: str,
    force: bool = False
) -> dict:
    try:
        logger.info(f"[UPSERT] {model_class.__name__} | year_month={year_month} | records={len(data)} | by={updated_by}")
        updated_count = 0
        inserted_count = 0

        for item in data:
            filter_dict = {'year_month': year_month}
            for field in unique_fields:
                if hasattr(item, field):
                    filter_dict[field] = getattr(item, field)

            existing = db.query(model_class).filter_by(**filter_dict).with_for_update().first()

            if existing:
                for key, value in item.dict(exclude_unset=True).items():
                    if hasattr(existing, key):
                        setattr(existing, key, value)
                existing.updated_by = updated_by
                updated_count += 1
            else:
                new_obj = model_class(
                    year_month=year_month,
                    updated_by=updated_by,
                    **item.dict(exclude={'year_month'})
                )
                db.add(new_obj)
                inserted_count += 1

        db.commit()
        logger.info(f"[UPSERT] {model_class.__name__} | COMPLETE | updated={updated_count} | inserted={inserted_count}")
        return {"status": "success", "message": f"Updated {len(data)} records", "updated": updated_count, "inserted": inserted_count}
    except HTTPException:
        raise
    except exc.OperationalError as e:
        db.rollback()
        if "lock" in str(e).lower():
            raise HTTPException(status_code=409, detail="Conflict: data modified by another user")
        logger.error(f"Upsert failed for {model_class.__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database operation failed: {str(e)}")
    except Exception as e:
        db.rollback()
        logger.error(f"Upsert failed for {model_class.__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database operation failed: {str(e)}")


def generic_single_upsert(
    db: Session,
    model_class: Type[DeclarativeMeta],
    year_month: str,
    data: Any,
    updated_by: str,
    force: bool = False
) -> dict:
    try:
        logger.info(f"[SINGLE_UPSERT] {model_class.__name__} | year_month={year_month} | by={updated_by}")
        existing = db.query(model_class).filter_by(year_month=year_month).with_for_update().first()
        action = "updated" if existing else "inserted"

        if existing:
            for key, value in data.dict(exclude_unset=True).items():
                if hasattr(existing, key) and key != 'year_month':
                    setattr(existing, key, value)
            existing.updated_by = updated_by
        else:
            data_dict = data.dict()
            data_dict.pop('year_month', None)
            new_obj = model_class(
                year_month=year_month,
                updated_by=updated_by,
                **data_dict
            )
            db.add(new_obj)

        db.commit()
        logger.info(f"[SINGLE_UPSERT] {model_class.__name__} | COMPLETE | action={action}")
        return {"status": "success", "action": action}
    except HTTPException:
        raise
    except exc.OperationalError as e:
        db.rollback()
        if "lock" in str(e).lower():
            raise HTTPException(status_code=409, detail="Conflict: data modified by another user")
        logger.error(f"Single upsert failed for {model_class.__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database operation failed: {str(e)}")
    except Exception as e:
        db.rollback()
        logger.error(f"Single upsert failed for {model_class.__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database operation failed: {str(e)}")


def create_save_endpoint(
    model_class: Type[DeclarativeMeta],
    schema_class: Type[BaseModel],
    unique_fields: List[str],
    auth_dependency: Callable
):
    async def save_endpoint(year_month: str, data: List[schema_class], db: Session, token: dict):
        return generic_upsert(
            db=db,
            model_class=model_class,
            year_month=year_month,
            data=data,
            unique_fields=unique_fields,
            updated_by=token["code"]
        )
    return save_endpoint
