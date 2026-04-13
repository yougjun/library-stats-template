"""
Template-Driven Routes — Generic template management and data entry API.
Upload templates, analyze structure, manage cell roles, enter monthly data,
and export filled Excel files.
"""

import hashlib
import logging
import os
import shutil
import tempfile
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies import get_db, validate_year_month, verify_any_token, format_changed_by
from app.models.template import TemplateConfig, CellData
from app.services.template_analyzer import analyze_template, auto_detect_cell_roles
from app.services.template_converter import xlsx_to_univer
from app.services.template_data_service import (
    get_editor_data_with_values,
    save_cell_values,
    export_to_xlsx,
)
from app.utils.file_validation import validate_excel_file, scan_file_for_malware
from app.config import config, BASE_DIR

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/template-driven", tags=["Template-Driven"])

TEMPLATE_STORAGE_DIR = os.path.join(BASE_DIR, "template", "driven")


def _ensure_storage_dir():
    os.makedirs(TEMPLATE_STORAGE_DIR, exist_ok=True)


class CellRolesRequest(BaseModel):
    roles: dict[str, str]


class SaveCellsRequest(BaseModel):
    cells: list[dict]


@router.post("/upload")
async def upload_template(
    file: UploadFile = File(...),
    name: str = Form(""),
    template_type: str = Form("current"),
    token: dict = Depends(verify_any_token),
    db: Session = Depends(get_db),
):
    logger.debug(f"[upload_template] entry: filename={file.filename}")

    if not file.filename or not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported")

    content = await file.read()

    is_valid, msg = validate_excel_file(content, file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)

    _ensure_storage_dir()

    file_hash = hashlib.sha256(content).hexdigest()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = file.filename.replace(" ", "_")
    stored_filename = f"{timestamp}_{safe_name}"
    stored_path = os.path.join(TEMPLATE_STORAGE_DIR, stored_filename)

    with open(stored_path, "wb") as f:
        f.write(content)

    is_clean, scan_msg = scan_file_for_malware(stored_path)
    if not is_clean:
        os.remove(stored_path)
        raise HTTPException(status_code=400, detail="File failed security scan")

    try:
        structure = analyze_template(stored_path)
        cell_roles = auto_detect_cell_roles(structure)
        univer_data = xlsx_to_univer(stored_path)
    except Exception as e:
        os.remove(stored_path)
        logger.error(f"[upload_template] analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Template analysis failed: {str(e)}")

    template_name = name or os.path.splitext(file.filename)[0]

    template_config = TemplateConfig(
        name=template_name,
        template_type=template_type,
        structure=structure,
        cell_roles=cell_roles,
        univer_data=univer_data,
        file_hash=file_hash,
        original_filename=file.filename,
        is_active=True,
    )
    db.add(template_config)
    db.commit()
    db.refresh(template_config)

    logger.info(f"[upload_template] exit: id={template_config.id}, name={template_name}")
    return {
        "id": template_config.id,
        "name": template_config.name,
        "sheets": len(structure["sheets"]),
        "total_cells": structure["total_cells"],
        "formula_count": structure["formula_count"],
        "merged_count": structure["merged_count"],
        "auto_detected_roles": len(cell_roles),
    }


@router.get("/configs")
def list_configs(
    token: dict = Depends(verify_any_token),
    db: Session = Depends(get_db),
):
    configs = db.query(TemplateConfig).filter_by(is_active=True).order_by(TemplateConfig.id.desc()).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "template_type": c.template_type,
            "file_hash": c.file_hash,
            "original_filename": c.original_filename,
            "sheet_count": len(c.structure.get("sheets", [])) if c.structure else 0,
            "created_at": str(c.created_at) if c.created_at else None,
            "updated_at": str(c.updated_at) if c.updated_at else None,
        }
        for c in configs
    ]


@router.get("/{config_id}/structure")
def get_structure(
    config_id: int,
    token: dict = Depends(verify_any_token),
    db: Session = Depends(get_db),
):
    cfg = db.query(TemplateConfig).filter_by(id=config_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Template config not found")
    return {
        "id": cfg.id,
        "name": cfg.name,
        "structure": cfg.structure,
        "cell_roles": cfg.cell_roles,
    }


@router.get("/{config_id}/editor")
def get_editor_data(
    config_id: int,
    token: dict = Depends(verify_any_token),
    db: Session = Depends(get_db),
):
    cfg = db.query(TemplateConfig).filter_by(id=config_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Template config not found")
    return {
        "univer_data": cfg.univer_data,
        "cell_roles": cfg.cell_roles,
    }


@router.post("/{config_id}/cell-roles")
def save_cell_roles(
    config_id: int,
    body: CellRolesRequest,
    token: dict = Depends(verify_any_token),
    db: Session = Depends(get_db),
):
    cfg = db.query(TemplateConfig).filter_by(id=config_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Template config not found")

    cfg.cell_roles = body.roles
    db.commit()

    logger.info(f"[save_cell_roles] saved {len(body.roles)} roles for config {config_id}")
    return {"saved": len(body.roles)}


@router.get("/{config_id}/data/{year_month}")
def get_monthly_data(
    config_id: int,
    year_month: str,
    token: dict = Depends(verify_any_token),
    db: Session = Depends(get_db),
):
    validate_year_month(year_month)
    try:
        result = get_editor_data_with_values(db, config_id, year_month)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{config_id}/data/{year_month}")
def save_monthly_data(
    config_id: int,
    year_month: str,
    body: SaveCellsRequest,
    token: dict = Depends(verify_any_token),
    db: Session = Depends(get_db),
):
    validate_year_month(year_month)

    cfg = db.query(TemplateConfig).filter_by(id=config_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Template config not found")

    changed_by = format_changed_by(token)
    count = save_cell_values(db, config_id, year_month, body.cells, updated_by=changed_by)
    return {"saved": count}


@router.get("/{config_id}/export/{year_month}")
def export_monthly_xlsx(
    config_id: int,
    year_month: str,
    token: dict = Depends(verify_any_token),
    db: Session = Depends(get_db),
):
    validate_year_month(year_month)

    cfg = db.query(TemplateConfig).filter_by(id=config_id).first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Template config not found")

    stored_files = sorted(
        [f for f in os.listdir(TEMPLATE_STORAGE_DIR) if f.endswith(".xlsx")],
        reverse=True,
    ) if os.path.exists(TEMPLATE_STORAGE_DIR) else []

    template_path = None
    for f in stored_files:
        path = os.path.join(TEMPLATE_STORAGE_DIR, f)
        h = hashlib.sha256(open(path, "rb").read()).hexdigest()
        if h == cfg.file_hash:
            template_path = path
            break

    if not template_path:
        raise HTTPException(
            status_code=404,
            detail="Original template file not found on disk",
        )

    output_dir = tempfile.mkdtemp()
    output_filename = f"{cfg.name}_{year_month}.xlsx"
    output_path = os.path.join(output_dir, output_filename)

    try:
        export_to_xlsx(db, config_id, year_month, template_path, output_path)
    except Exception as e:
        logger.error(f"[export_monthly_xlsx] failed: {e}")
        shutil.rmtree(output_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

    return FileResponse(
        output_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=output_filename,
    )
