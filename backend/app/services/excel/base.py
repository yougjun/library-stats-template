"""
Excel Base Generator — Shared helpers for Excel generation.

Provides date formatting, metadata writing, and cell-value extraction
utilities used by the template-driven Excel generator.
"""

from sqlalchemy.orm import Session
from datetime import datetime
import calendar


class ExcelBaseGenerator:
    def __init__(self, db: Session):
        self.db = db

    def _get_korean_day_of_week(self, date_str: str) -> str:
        days = ['월', '화', '수', '목', '금', '토', '일']
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
        return days[date_obj.weekday()]

    def _get_operation_period(self, year_month: str) -> str:
        year = year_month.split('-')[0]
        month = int(year_month.split('-')[1])
        last_day = calendar.monthrange(int(year), month)[1]
        return f"{year}-{str(month).zfill(2)}-01 ~ {year}-{str(month).zfill(2)}-{str(last_day).zfill(2)}"

    def _get_update_datetime(self, format_str: str = 'YYYY-MM-DD HH:MM:SS') -> str:
        now = datetime.now()
        if format_str == 'YYYY-MM-DD HH:MM:SS':
            return now.strftime('%Y-%m-%d %H:%M:%S')
        elif format_str == 'YYYY-MM-DD':
            return now.strftime('%Y-%m-%d')
        elif format_str == 'YYYY년 MM월 DD일 HH:MM':
            return now.strftime('%Y년 %m월 %d일 %H:%M')
        elif format_str == 'YYYY년 MM월 DD일':
            return now.strftime('%Y년 %m월 %d일')
        return now.strftime('%Y-%m-%d %H:%M:%S')

    def get_val(self, cell) -> int:
        if cell is None:
            return 0
        if hasattr(cell, 'value'):
            val = cell.value
        else:
            val = cell

        if val is None:
            return 0
        if isinstance(val, (int, float)):
            return int(val)
        if isinstance(val, str):
            try:
                return int(float(val))
            except (ValueError, TypeError):
                return 0
        return 0
