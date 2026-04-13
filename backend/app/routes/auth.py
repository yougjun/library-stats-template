"""
Auth Routes — Authentication endpoints for site access, access-code login,
token refresh, remember-me persistence, and password management.
"""

import time
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import config
from app.dependencies import get_db, verify_any_token
from app.services.auth import create_access_token, pwd_context
from app.services.device import RememberTokenService, COOKIE_NAME
from app import models, schemas

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/verify-site-password", response_model=schemas.SitePasswordResponse)
@limiter.limit("5/minute")
async def verify_site_password(
    request: Request,
    data: schemas.SitePasswordVerify,
    db: Session = Depends(get_db),
):
    site_pwd = db.query(models.SitePassword).order_by(models.SitePassword.id.desc()).first()

    if not site_pwd:
        logger.error("No site password configured in database")
        raise HTTPException(status_code=500, detail="Site password not configured")

    try:
        is_valid = pwd_context.verify(data.password, site_pwd.password_hash)
    except Exception as e:
        logger.error(f"Password verification error: {str(e)}")
        time.sleep(1)
        return schemas.SitePasswordResponse(valid=False)

    if is_valid:
        token = create_access_token({"type": "site_access"})
        logger.info("Site password verification successful")
        return schemas.SitePasswordResponse(valid=True, token=token)

    logger.warning(f"Failed site password attempt from {request.client.host if request.client else 'unknown'}")
    time.sleep(1)
    return schemas.SitePasswordResponse(valid=False)


@router.post("/verify-code", response_model=schemas.TokenResponse)
@limiter.limit("10/minute")
async def verify_access_code(
    request: Request,
    data: schemas.AccessCodeVerify,
    db: Session = Depends(get_db),
):
    access_code = db.query(models.AccessCode).filter(
        models.AccessCode.code == data.access_code,
        models.AccessCode.is_active == True,
        or_(
            models.AccessCode.expires_at.is_(None),
            models.AccessCode.expires_at > datetime.utcnow(),
        ),
    ).first()

    if not access_code:
        logger.warning(f"Failed access code attempt from {request.client.host if request.client else 'unknown'}")
        return schemas.TokenResponse(valid=False)

    token = create_access_token({"role": access_code.role, "code": access_code.code})
    refresh_token = create_access_token(
        {"role": access_code.role, "code": access_code.code},
        token_type="refresh",
    )

    logger.info(f"Access code verification successful for role: {access_code.role}")

    return schemas.TokenResponse(
        valid=True,
        role=access_code.role,
        token=token,
        expires_in=config.ACCESS_TOKEN_EXPIRE_HOURS * 3600,
    )


@router.post("/refresh", response_model=schemas.TokenResponse)
@limiter.limit("20/minute")
async def refresh_access_token(
    request: Request,
    data: schemas.RefreshTokenRequest,
):
    try:
        payload = jwt.decode(data.refresh_token, config.SECRET_KEY, algorithms=[config.ALGORITHM])

        if payload.get("token_type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")

        new_token = create_access_token({"role": payload.get("role"), "code": payload.get("code")})

        return schemas.TokenResponse(
            valid=True,
            role=payload.get("role"),
            token=new_token,
            expires_in=config.ACCESS_TOKEN_EXPIRE_HOURS * 3600,
        )
    except JWTError:
        logger.warning(f"Failed token refresh from {request.client.host if request.client else 'unknown'}")
        raise HTTPException(status_code=401, detail="Invalid refresh token")


@router.get("/verify-remember")
@limiter.limit("30/minute")
async def verify_remember(
    request: Request,
    db: Session = Depends(get_db),
):
    cookie_value = request.cookies.get(COOKIE_NAME, "")
    if not cookie_value:
        return {"trusted": False}
    return RememberTokenService.verify_token(db, cookie_value)


@router.post("/remember-me")
@limiter.limit("10/minute")
async def remember_me(
    request: Request,
    data: schemas.RememberMeRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    token_payload = verify_any_token(request)

    if data.access_type == "site":
        if token_payload.get("type") != "site_access":
            raise HTTPException(status_code=403, detail="Site token required for site remember-me")
    elif data.access_type == "edit":
        token_role = token_payload.get("role")
        if not token_role:
            raise HTTPException(status_code=403, detail="Edit token required for edit remember-me")
        if data.access_role and data.access_role != token_role:
            raise HTTPException(status_code=403, detail="Token role mismatch")
        data.access_role = token_role
        if not data.access_code:
            data.access_code = token_payload.get("code", token_role)

    result = RememberTokenService.create_token(
        db,
        access_type=data.access_type,
        access_role=data.access_role,
        access_code=data.access_code,
        device_name=data.device_name,
    )

    if result.get("success"):
        response.set_cookie(
            key=COOKIE_NAME,
            value=result["cookie_value"],
            max_age=result["max_age"],
            httponly=True,
            samesite="lax",
            secure=config.is_production(),
            path="/",
        )
        del result["cookie_value"]

    return result


@router.delete("/forget-me")
@limiter.limit("10/minute")
async def forget_me(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    cookie_value = request.cookies.get(COOKIE_NAME, "")
    result = RememberTokenService.revoke_token(db, cookie_value)
    response.delete_cookie(
        COOKIE_NAME,
        path="/",
        samesite="lax",
        secure=config.is_production(),
    )
    return result


@router.post("/set-site-password")
@limiter.limit("3/minute")
async def set_site_password(
    request: Request,
    data: schemas.PasswordSetRequest,
    db: Session = Depends(get_db),
):
    try:
        payload = jwt.decode(data.admin_token, config.SECRET_KEY, algorithms=[config.ALGORITHM])

        role = payload.get("role")
        if role != "admin" and role not in ("EDITOR", "VIEWER"):
            raise HTTPException(status_code=403, detail="Admin access required")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid admin token")

    password_hash = pwd_context.hash(data.new_password)

    try:
        db.query(models.SitePassword).delete()

        new_password = models.SitePassword(
            password_hash=password_hash,
            updated_by=payload.get("code", "admin"),
        )
        db.add(new_password)
        db.commit()

        logger.info(f"Site password updated by {payload.get('code', 'admin')}")
        return {"status": "success", "message": "Site password updated successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update site password: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update password")


@router.post("/change-site-password")
@limiter.limit("3/minute")
async def change_site_password(
    request: Request,
    data: schemas.PasswordChangeRequest,
    db: Session = Depends(get_db),
):
    site_pwd = db.query(models.SitePassword).order_by(models.SitePassword.id.desc()).first()

    if not site_pwd:
        raise HTTPException(status_code=500, detail="Site password not configured")

    if not pwd_context.verify(data.current_password, site_pwd.password_hash):
        logger.warning(f"Failed password change attempt from {request.client.host if request.client else 'unknown'}")
        raise HTTPException(status_code=401, detail="Current password incorrect")

    new_hash = pwd_context.hash(data.new_password)

    try:
        db.query(models.SitePassword).delete()

        new_password = models.SitePassword(
            password_hash=new_hash,
            updated_by="user",
        )
        db.add(new_password)
        db.commit()

        logger.info("Site password changed by user")
        return {"status": "success", "message": "Password changed successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to change password: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to change password")
