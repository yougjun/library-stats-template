"""
Automation Routes — Generic automation tool management.

Provides download/upload endpoints for automation ZIP packages,
and exclusion rules for controlling automation per month.
"""

import os
import shutil
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.dependencies import get_db
from app.services.auth import verify_token
from app.config import config, BASE_DIR
from app import models

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/automation", tags=["Automation"])

AUTOMATION_ZIP_PATH = str(BASE_DIR / "Automation_Tool.zip")


@router.get("/download")
async def download_automation_tool(token: dict = Depends(verify_token)):
    logger.debug("[download_automation_tool] entry")
    if not os.path.exists(AUTOMATION_ZIP_PATH):
        raise HTTPException(status_code=404, detail="Automation file not found")

    return FileResponse(
        AUTOMATION_ZIP_PATH,
        media_type="application/zip",
        filename="Automation_Tool.zip",
    )


@router.post("/upload")
@limiter.limit("5/minute")
async def upload_automation_tool(
    request: Request,
    file: UploadFile = File(...),
    token: dict = Depends(verify_token),
):
    logger.info(f"[upload_automation_tool] entry: user={token.get('code')}")
    if token.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")

    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only ZIP files are allowed")

    try:
        backup_path = f"{AUTOMATION_ZIP_PATH}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        if os.path.exists(AUTOMATION_ZIP_PATH):
            shutil.copy2(AUTOMATION_ZIP_PATH, backup_path)
            logger.info(f"[AUTOMATION] Backed up existing ZIP to: {backup_path}")

        file_content = await file.read()
        with open(AUTOMATION_ZIP_PATH, "wb") as buffer:
            buffer.write(file_content)

        file_size = len(file_content)
        logger.info(f"[AUTOMATION] New ZIP uploaded by {token.get('code', 'unknown')}, size: {file_size} bytes")

        return {
            "status": "success",
            "message": "Automation program updated",
            "filename": file.filename,
            "size": file_size,
            "backup": os.path.basename(backup_path) if os.path.exists(backup_path) else None,
        }
    except Exception as e:
        logger.error(f"[AUTOMATION] Upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.get("/info")
async def get_automation_info(token: dict = Depends(verify_token)):
    logger.debug("[get_automation_info] entry")
    if not os.path.exists(AUTOMATION_ZIP_PATH):
        return {"exists": False, "size": 0, "modified": None}

    stat = os.stat(AUTOMATION_ZIP_PATH)
    return {
        "exists": True,
        "size": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
    }


@router.get("/exclusions")
async def get_automation_exclusions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    logger.debug(f"[get_automation_exclusions] entry: skip={skip}, limit={limit}")
    exclusions = (
        db.query(models.AutomationExclusion)
        .order_by(models.AutomationExclusion.year_month.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": e.id,
            "year_month": e.year_month,
            "floor": e.floor,
            "reason": e.reason,
            "created_at": e.created_at,
            "created_by": e.created_by,
        }
        for e in exclusions
    ]


@router.post("/exclusions")
@limiter.limit("10/minute")
async def add_automation_exclusion(
    request: Request,
    data: dict = None,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    logger.info("[add_automation_exclusion] entry")
    try:
        if not data:
            raise HTTPException(status_code=400, detail="Request body is required")

        year_month = data.get("year_month")
        floor = data.get("floor", "default")
        reason = data.get("reason", "")
        created_by = data.get("created_by", "user")

        if not year_month:
            raise HTTPException(status_code=400, detail="year_month is required")

        existing = db.query(models.AutomationExclusion).filter(
            models.AutomationExclusion.year_month == year_month,
            models.AutomationExclusion.floor == floor,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Exclusion already exists for this month")

        exclusion = models.AutomationExclusion(
            year_month=year_month,
            floor=floor,
            reason=reason,
            created_by=created_by,
        )
        db.add(exclusion)
        db.commit()
        db.refresh(exclusion)

        logger.info(f"[add_automation_exclusion] exit: id={exclusion.id}, {floor}/{year_month}")
        return {
            "id": exclusion.id,
            "year_month": exclusion.year_month,
            "floor": exclusion.floor,
            "reason": exclusion.reason,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"[add_automation_exclusion] failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/exclusions/{exclusion_id}")
@limiter.limit("10/minute")
async def delete_automation_exclusion(
    request: Request,
    exclusion_id: int,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    logger.info(f"[delete_automation_exclusion] entry: id={exclusion_id}")
    try:
        exclusion = db.query(models.AutomationExclusion).filter(
            models.AutomationExclusion.id == exclusion_id
        ).first()
        if not exclusion:
            raise HTTPException(status_code=404, detail="Exclusion not found")

        db.delete(exclusion)
        db.commit()
        logger.info(f"[delete_automation_exclusion] exit: deleted id={exclusion_id}")
        return {"status": "success", "message": "Exclusion deleted"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"[delete_automation_exclusion] failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
