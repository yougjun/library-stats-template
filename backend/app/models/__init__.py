"""
Models Package — Re-exports all models for convenient imports.
Usage: from app.models import User, Settings, TemplateConfig, ...
"""

from app.models.base import Base, engine, SessionLocal

from app.models.auth import User, AccessCode, SitePassword, RememberToken

from app.models.statistics import MonthlyBase, RawAgeStatistics, AuditLog

from app.models.settings import Settings, MultiplierHistory, AutomationExclusion

from app.models.weather import WeatherData, WeatherForecast

from app.models.chat import ChatSession, ChatHistory, IndexedDocument

from app.models.template import TemplateConfig, CellData

__all__ = [
    "Base", "engine", "SessionLocal",
    "User", "AccessCode", "SitePassword", "RememberToken",
    "MonthlyBase", "RawAgeStatistics", "AuditLog",
    "Settings", "MultiplierHistory", "AutomationExclusion",
    "WeatherData", "WeatherForecast",
    "ChatSession", "ChatHistory", "IndexedDocument",
    "TemplateConfig", "CellData",
]
