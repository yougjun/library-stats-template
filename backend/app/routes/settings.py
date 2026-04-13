"""
Settings Routes — CRUD for application configuration.

Manages key-value settings (holidays, library dates, header aliases)
stored in the Settings table.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from datetime import datetime

from app.dependencies import get_db
from app.services.auth import verify_token
from app.utils.holidays import update_holidays_in_db
from app import models, schemas
from app.config import config

from slowapi import Limiter
from slowapi.util import get_remote_address

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Settings"])

limiter = Limiter(key_func=get_remote_address)

SETTING_DEFAULTS = {
    "holidays": [],
    "library_year_start_date": "2025-01-01",
    "update_date_format": "YYYY-MM-DD HH:MM:SS",
    "holiday_api_service_key": "",
    "header_aliases": None,
}

PUBLIC_KEYS = [
    "holidays",
    "library_year_start_date",
]


def _get_setting(db: Session, key: str):
    setting = db.query(models.Settings).filter(models.Settings.key == key).first()
    if setting:
        return setting.value
    return SETTING_DEFAULTS.get(key)


def _set_setting(db: Session, key: str, value, updated_by: str = "system"):
    setting = db.query(models.Settings).filter(models.Settings.key == key).first()
    if setting:
        setting.value = value
        setting.updated_by = updated_by
        flag_modified(setting, "value")
    else:
        db.add(models.Settings(key=key, value=value, updated_by=updated_by))


@router.get("/settings/public")
async def get_public_settings(db: Session = Depends(get_db)):
    logger.debug("[get_public_settings] entry")
    result = {}
    for key in PUBLIC_KEYS:
        result[key] = _get_setting(db, key)
    logger.debug(f"[get_public_settings] exit: keys={list(result.keys())}")
    return result


@router.get("/settings")
async def get_all_settings(
    db: Session = Depends(get_db),
    token_data: dict = Depends(verify_token),
):
    logger.debug(f"[get_all_settings] entry: user={token_data.get('code')}")
    result = {}
    for key, default in SETTING_DEFAULTS.items():
        result[key] = _get_setting(db, key)
    logger.debug(f"[get_all_settings] exit: keys={list(result.keys())}")
    return result


@router.post("/settings")
@limiter.limit("10/minute")
async def update_settings(
    request: Request,
    payload: schemas.SettingsUpdate,
    db: Session = Depends(get_db),
    token_data: dict = Depends(verify_token),
):
    changed_by = token_data.get("code", "unknown")
    logger.info(f"[update_settings] entry: user={changed_by}")

    updated_keys = []

    if payload.holidays is not None:
        _set_setting(db, "holidays", [h.model_dump() for h in payload.holidays], changed_by)
        updated_keys.append("holidays")

    if payload.library_year_start_date is not None:
        _set_setting(db, "library_year_start_date", payload.library_year_start_date, changed_by)
        updated_keys.append("library_year_start_date")

    if payload.update_date_format is not None:
        _set_setting(db, "update_date_format", payload.update_date_format, changed_by)
        updated_keys.append("update_date_format")

    if payload.holiday_api_service_key is not None:
        _set_setting(db, "holiday_api_service_key", payload.holiday_api_service_key, changed_by)
        updated_keys.append("holiday_api_service_key")

    if payload.header_aliases is not None:
        _set_setting(db, "header_aliases", payload.header_aliases.model_dump(), changed_by)
        updated_keys.append("header_aliases")

    if not updated_keys:
        raise HTTPException(status_code=400, detail="No settings provided to update")

    db.commit()

    logger.info(f"[update_settings] exit: updated={updated_keys}")
    return {"message": "Settings updated", "updated": updated_keys}


@router.post("/settings/fetch-holidays/{year}")
@limiter.limit("5/minute")
async def fetch_holidays(
    request: Request,
    year: int,
    db: Session = Depends(get_db),
    token_data: dict = Depends(verify_token),
):
    logger.info(f"[fetch_holidays] entry: year={year}, user={token_data.get('code')}")
    if year < 2000 or year > 2100:
        raise HTTPException(status_code=400, detail="Year must be between 2000 and 2100")

    result = update_holidays_in_db(db, year)

    if not result.get("success"):
        logger.error(f"[fetch_holidays] failed: {result.get('message')}")
        raise HTTPException(status_code=500, detail=result.get("message", "Failed to fetch holidays"))

    logger.info(f"[fetch_holidays] exit: count={result.get('count')}")
    return result
