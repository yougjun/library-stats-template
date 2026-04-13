"""
Common Schemas — Shared base models and sync data containers.
YearMonthBase provides validated YYYY-MM format used by all data schemas.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List
import re


class YearMonthBase(BaseModel):
    year_month: str = Field(..., pattern=r'^\d{4}-\d{2}$')

    @validator('year_month')
    def validate_year_month(cls, v):
        if not re.match(r'^\d{4}-\d{2}$', v):
            raise ValueError('Invalid year_month format. Use YYYY-MM')
        year, month = map(int, v.split('-'))
        if not (2000 <= year <= 2100 and 1 <= month <= 12):
            raise ValueError('Invalid year or month range')
        return v


class CompletionStatusUpdate(BaseModel):
    is_completed: Optional[bool] = None
