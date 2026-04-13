"""
Schemas Package — Re-exports all Pydantic schemas.
"""

from app.schemas.common import YearMonthBase, CompletionStatusUpdate

from app.schemas.auth import (
    AccessCodeVerify, SitePasswordVerify, SitePasswordResponse,
    TokenResponse, RefreshTokenRequest,
    PasswordSetRequest, PasswordChangeRequest,
    RememberMeRequest, AdminCreate, AdminUpdate, AdminResponse,
)

from app.schemas.settings import (
    HolidayEntry, HeaderAliasConfig, SettingsUpdate,
    MultiplierHistoryCreate, MultiplierHistoryResponse, SettingsResponse,
)

from app.schemas.chat import ChatRequest, ChatResponse, ChatHistoryItem
