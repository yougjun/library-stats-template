"""
Auth Schemas — Request/response models for authentication endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal


class AccessCodeVerify(BaseModel):
    access_code: str


class SitePasswordVerify(BaseModel):
    password: str


class SitePasswordResponse(BaseModel):
    valid: bool
    token: Optional[str] = None


class TokenResponse(BaseModel):
    valid: bool
    role: Optional[str] = None
    token: Optional[str] = None
    expires_in: Optional[int] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class PasswordSetRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=100)
    admin_token: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=100)


class RememberMeRequest(BaseModel):
    access_type: Literal["site", "edit"]
    access_role: Optional[str] = None
    access_code: Optional[str] = None
    device_name: Optional[str] = None


class AdminCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(..., pattern=r'^(editor|viewer|admin)$')
    description: Optional[str] = None


class AdminUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    role: Optional[str] = Field(None, pattern=r'^(editor|viewer|admin)$')
    code: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class AdminResponse(BaseModel):
    id: int
    code: str
    name: str
    role: str
    description: Optional[str]
    is_active: bool
    created_at: str
