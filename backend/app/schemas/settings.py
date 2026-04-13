"""
Settings Schemas — Validation for settings management.
"""

from pydantic import BaseModel
from typing import Optional, List


class HolidayEntry(BaseModel):
    start_date: str
    end_date: str
    condition: Optional[str] = ""


class HeaderAliasConfig(BaseModel):
    program: Optional[dict] = None
    ai: Optional[dict] = None


class SettingsUpdate(BaseModel):
    holidays: Optional[List[HolidayEntry]] = None
    library_year_start_date: Optional[str] = None
    update_date_format: Optional[str] = None
    holiday_api_service_key: Optional[str] = None
    header_aliases: Optional[HeaderAliasConfig] = None


class SettingsResponse(BaseModel):
    holidays: List[HolidayEntry]
    library_year_start_date: str
    update_date_format: str
    holiday_api_service_key: str
    header_aliases: Optional[dict] = None
