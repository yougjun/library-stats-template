"""
Admin Routes — Access code CRUD for managing editor accounts.
"""

import secrets
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.dependencies import get_db
from app.services.auth import verify_token
from app import models, schemas

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/list")
@limiter.limit("30/minute")
async def list_admins(request: Request, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), token: dict = Depends(verify_token)):
    admins = db.query(models.AccessCode).offset(skip).limit(limit).all()
    return [
        {
            "id": admin.id,
            "code": admin.code,
            "name": admin.name or "Manager",
            "role": admin.role,
            "description": admin.description,
            "is_active": admin.is_active,
            "created_at": admin.created_at.isoformat() if admin.created_at else None
        }
        for admin in admins
    ]


@router.post("/create")
@limiter.limit("10/minute")
async def create_admin(request: Request, data: schemas.AdminCreate, db: Session = Depends(get_db), token: dict = Depends(verify_token)):
    access_code = secrets.token_urlsafe(32)

    role_map = {
        "editor": "EDITOR",
        "viewer": "VIEWER",
        "admin": "admin"
    }

    try:
        new_admin = models.AccessCode(
            code=access_code,
            name=data.name,
            role=role_map[data.role],
            description=data.description,
            is_active=True
        )
        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)

        logger.info(f"Admin created: {data.name} ({data.role}) by {token.get('code')}")

        return {
            "id": new_admin.id,
            "code": new_admin.code,
            "name": new_admin.name,
            "role": new_admin.role,
            "description": new_admin.description,
            "is_active": new_admin.is_active,
            "created_at": new_admin.created_at.isoformat()
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create admin: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create admin")


@router.put("/{admin_id}")
@limiter.limit("20/minute")
async def update_admin(request: Request, admin_id: int, data: schemas.AdminUpdate, db: Session = Depends(get_db), token: dict = Depends(verify_token)):
    admin = db.query(models.AccessCode).filter(models.AccessCode.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    role_map = {
        "editor": "EDITOR",
        "viewer": "VIEWER",
        "admin": "admin"
    }

    try:
        if data.name is not None:
            admin.name = data.name
        if data.role is not None:
            admin.role = role_map[data.role]
        if data.code is not None and data.code.strip():
            existing = db.query(models.AccessCode).filter(
                models.AccessCode.code == data.code,
                models.AccessCode.id != admin_id
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail="Access code already in use")
            admin.code = data.code
        if data.description is not None:
            admin.description = data.description
        if data.is_active is not None:
            admin.is_active = data.is_active

        db.commit()
        logger.info(f"Admin updated: ID {admin_id} by {token.get('code')}")

        return {
            "id": admin.id,
            "code": admin.code,
            "name": admin.name,
            "role": admin.role,
            "description": admin.description,
            "is_active": admin.is_active,
            "created_at": admin.created_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update admin: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update admin")


@router.delete("/{admin_id}")
@limiter.limit("10/minute")
async def delete_admin(request: Request, admin_id: int, db: Session = Depends(get_db), token: dict = Depends(verify_token)):
    admin = db.query(models.AccessCode).filter(models.AccessCode.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")

    try:
        db.delete(admin)
        db.commit()
        logger.info(f"Admin deleted: ID {admin_id} by {token.get('code')}")
        return {"status": "success", "message": "Admin deleted"}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete admin: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete admin")
