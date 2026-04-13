"""
Excel Routes — Template management and template-driven Excel export.

Provides endpoints for downloading and uploading Excel templates (current,
old, new versions), template editor (Univer), and cell mapping management.
"""

import json
import os
import shutil
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.dependencies import get_db
from app.services.auth import verify_token
from app.services.template_converter import xlsx_to_univer, univer_to_xlsx
from app.utils.file_validation import validate_excel_file, scan_file_for_malware
from app.config import config
from app import models

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api", tags=["Excel"])

TEMPLATE_PATH = config.TEMPLATE_PATH
XLSX_MEDIA = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}


# ── Template management ──────────────────────────────────────────────


def _require_template(path: str = TEMPLATE_PATH) -> None:
    if not os.path.exists(path):
        logger.error(f"[_require_template] Template file not found at: {path}")
        raise HTTPException(
            status_code=500,
            detail="Template file not found. Please upload a template in Settings.",
        )


@router.get("/template/download")
async def download_template(token: dict = Depends(verify_token)):
    logger.info(f"[download_template] path={TEMPLATE_PATH}, exists={os.path.exists(TEMPLATE_PATH)}")
    if not os.path.exists(TEMPLATE_PATH):
        raise HTTPException(status_code=404, detail="Template file not found")

    logger.info(f"[download_template] serving size={os.path.getsize(TEMPLATE_PATH)} bytes")
    return FileResponse(
        TEMPLATE_PATH,
        media_type=XLSX_MEDIA,
        filename=os.path.basename(TEMPLATE_PATH),
        headers=NO_CACHE_HEADERS,
    )


@router.post("/template/upload")
@limiter.limit("10/minute")
async def upload_template(
    request: Request,
    file: UploadFile = File(...),
    token: dict = Depends(verify_token),
):
    logger.debug(f"[upload_template] entry: filename={file.filename}")

    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400, detail="Only Excel files (.xlsx, .xls) are allowed"
        )

    file_content = await file.read()

    is_valid, validation_msg = validate_excel_file(file_content, file.filename)
    if not is_valid:
        logger.warning(f"[upload_template] invalid file: {validation_msg} - {file.filename}")
        raise HTTPException(status_code=400, detail=f"Invalid file: {validation_msg}")

    try:
        fallback_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "template", config.TEMPLATE_FILENAME
        )

        if os.path.exists(TEMPLATE_PATH):
            backup_path = f"{TEMPLATE_PATH}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            shutil.copy2(TEMPLATE_PATH, backup_path)
            logger.info(f"[upload_template] backup created: {backup_path}")

        with open(TEMPLATE_PATH, "wb") as buffer:
            buffer.write(file_content)

        is_clean, scan_msg = scan_file_for_malware(TEMPLATE_PATH)
        if not is_clean:
            os.remove(TEMPLATE_PATH)
            logger.error(f"[upload_template] malware detected: {file.filename}")
            raise HTTPException(status_code=400, detail="File rejected: malware detected")

        if fallback_path != TEMPLATE_PATH:
            os.makedirs(os.path.dirname(fallback_path), exist_ok=True)
            with open(fallback_path, "wb") as buffer:
                buffer.write(file_content)
            logger.info(f"[upload_template] fallback saved: {fallback_path}")

        logger.info(f"[upload_template] success by {token.get('code', 'unknown')}")
        return {
            "status": "success",
            "message": "Template uploaded successfully",
            "filename": file.filename,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[upload_template] failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to upload template: {str(e)}"
        )


# ── Versioned template endpoints (old / new) ────────────────────────


@router.get("/template/old/download")
async def download_old_template(token: dict = Depends(verify_token)):
    old_template_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "template", config.TEMPLATE_FILENAME
    )
    logger.info(f"[download_old_template] path={old_template_path}")

    if not os.path.exists(old_template_path):
        raise HTTPException(status_code=404, detail="Old template file not found")

    return FileResponse(
        old_template_path,
        media_type=XLSX_MEDIA,
        filename=config.TEMPLATE_FILENAME,
        headers=NO_CACHE_HEADERS,
    )


@router.get("/template/new/download")
async def download_new_template(token: dict = Depends(verify_token)):
    base = config.TEMPLATE_FILENAME.replace(".xlsx", "")
    new_filename = f"{base}_new.xlsx"
    new_template_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "template", new_filename
    )
    logger.info(f"[download_new_template] path={new_template_path}")

    if not os.path.exists(new_template_path):
        raise HTTPException(status_code=404, detail="New template file not found")

    return FileResponse(
        new_template_path,
        media_type=XLSX_MEDIA,
        filename=new_filename,
        headers=NO_CACHE_HEADERS,
    )


@router.post("/template/old/upload")
@limiter.limit("10/minute")
async def upload_old_template(
    request: Request,
    file: UploadFile = File(...),
    token: dict = Depends(verify_token),
):
    logger.debug(f"[upload_old_template] entry: filename={file.filename}")

    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400, detail="Only Excel files (.xlsx, .xls) are allowed"
        )

    try:
        backend_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "template", config.TEMPLATE_FILENAME
        )

        file_content = await file.read()

        for path in [backend_path]:
            if os.path.exists(path):
                backup_path = f"{path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                shutil.copy2(path, backup_path)
                logger.info(f"[upload_old_template] backup created: {backup_path}")
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as buffer:
                buffer.write(file_content)
            logger.info(f"[upload_old_template] saved to: {path}")

        logger.info(f"[upload_old_template] success by {token.get('code', 'unknown')}")
        return {
            "status": "success",
            "message": "Old template uploaded successfully",
            "filename": file.filename,
        }

    except Exception as e:
        logger.error(f"[upload_old_template] failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to upload old template: {str(e)}"
        )


@router.post("/template/new/upload")
@limiter.limit("10/minute")
async def upload_new_template(
    request: Request,
    file: UploadFile = File(...),
    token: dict = Depends(verify_token),
):
    logger.debug(f"[upload_new_template] entry: filename={file.filename}")

    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400, detail="Only Excel files (.xlsx, .xls) are allowed"
        )

    try:
        base = config.TEMPLATE_FILENAME.replace(".xlsx", "")
        new_filename = f"{base}_new.xlsx"
        backend_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "template", new_filename
        )

        file_content = await file.read()

        for path in [backend_path]:
            if os.path.exists(path):
                backup_path = f"{path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                shutil.copy2(path, backup_path)
                logger.info(f"[upload_new_template] backup created: {backup_path}")
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as buffer:
                buffer.write(file_content)
            logger.info(f"[upload_new_template] saved to: {path}")

        logger.info(f"[upload_new_template] success by {token.get('code', 'unknown')}")
        return {
            "status": "success",
            "message": "New template uploaded successfully",
            "filename": file.filename,
        }

    except Exception as e:
        logger.error(f"[upload_new_template] failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to upload new template: {str(e)}"
        )


# ── Template editor (Univer) ────────────────────────────────────────


def _resolve_template_path(template_type: str) -> str:
    base = config.TEMPLATE_FILENAME.replace(".xlsx", "")
    if template_type == "current":
        return TEMPLATE_PATH
    elif template_type == "old":
        return os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "template", config.TEMPLATE_FILENAME
        )
    elif template_type == "new":
        return os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "template", f"{base}_new.xlsx"
        )
    raise HTTPException(status_code=400, detail=f"Invalid template type: {template_type}")


@router.get("/template/{template_type}/editor-data")
async def get_template_editor_data(
    template_type: str,
    token: dict = Depends(verify_token),
):
    logger.debug(f"[get_template_editor_data] entry: type={template_type}")
    path = _resolve_template_path(template_type)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Template file not found")

    try:
        data = xlsx_to_univer(path)
        logger.info(f"[get_template_editor_data] exit: sheets={len(data.get('sheets', {}))}")
        return data
    except Exception as e:
        logger.error(f"[get_template_editor_data] failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to convert template: {str(e)}")


@router.post("/template/{template_type}/editor-data")
async def save_template_editor_data(
    template_type: str,
    request: Request,
    token: dict = Depends(verify_token),
):
    logger.debug(f"[save_template_editor_data] entry: type={template_type}")
    path = _resolve_template_path(template_type)

    if os.path.exists(path):
        backup_path = f"{path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy2(path, backup_path)
        logger.info(f"[save_template_editor_data] backup created: {backup_path}")

    try:
        data = await request.json()
        univer_to_xlsx(data, path)
        logger.info(f"[save_template_editor_data] exit: saved to {path}")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"[save_template_editor_data] failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save template: {str(e)}")


# ── Cell mapping management ───────────────────────────────────────


@router.get("/field-catalog")
async def get_field_catalog_endpoint(token: dict = Depends(verify_token)):
    logger.debug("[get_field_catalog] entry")
    from app.mappings.field_catalog import get_catalog_tree
    tree = get_catalog_tree()
    logger.info(f"[get_field_catalog] exit: {len(tree)} top-level categories")
    return tree


@router.get("/template/{template_type}/cell-mappings")
async def get_cell_mappings(
    template_type: str,
    token: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    logger.debug(f"[get_cell_mappings] entry: type={template_type}")
    key = f"cell_mappings_{template_type}"
    row = db.query(models.Settings).filter(models.Settings.key == key).first()
    if not row:
        logger.info(f"[get_cell_mappings] no mappings found for '{key}'")
        return {"version": 1, "mappings": {}}
    logger.info(f"[get_cell_mappings] exit: found mappings for '{key}'")
    return row.value if isinstance(row.value, dict) else json.loads(row.value)


class CellMappingsSaveRequest(BaseModel):
    version: int = 1
    mappings: dict


@router.post("/template/{template_type}/cell-mappings")
async def save_cell_mappings(
    template_type: str,
    request: CellMappingsSaveRequest,
    token: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    logger.debug(f"[save_cell_mappings] entry: type={template_type}, count={len(request.mappings)}")
    from app.mappings.field_catalog import get_field_by_id

    invalid_ids = [fid for fid in request.mappings.values() if not get_field_by_id(fid)]
    if invalid_ids:
        logger.warning(f"[save_cell_mappings] invalid field IDs: {invalid_ids[:5]}")
        raise HTTPException(status_code=400, detail=f"Unknown field IDs: {invalid_ids[:5]}")

    key = f"cell_mappings_{template_type}"
    data = {"version": request.version, "mappings": request.mappings}

    row = db.query(models.Settings).filter(models.Settings.key == key).first()
    if row:
        row.value = data
        row.updated_by = token.get("code", "unknown")
    else:
        row = models.Settings(key=key, value=data, updated_by=token.get("code", "unknown"))
        db.add(row)
    db.commit()
    logger.info(f"[save_cell_mappings] exit: saved {len(request.mappings)} mappings for '{key}'")
    return {"status": "success", "count": len(request.mappings)}
