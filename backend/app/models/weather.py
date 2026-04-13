"""
Weather Models — Historical weather data and forecast records.
Used by the prediction service to correlate library usage with weather patterns.
"""

from sqlalchemy import Column, Integer, String, Date, Numeric, TIMESTAMP, Index
from sqlalchemy.sql import func

from app.models.base import Base


class WeatherData(Base):
    __tablename__ = "weather_data"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    station_id = Column(String(10), nullable=False)
    avg_temp = Column(Numeric(5, 2))
    max_temp = Column(Numeric(5, 2))
    min_temp = Column(Numeric(5, 2))
    precipitation = Column(Numeric(6, 2))
    humidity = Column(Numeric(5, 2))
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    __table_args__ = (
        Index('idx_weather_data_date', 'date'),
        Index('idx_weather_data_station', 'station_id'),
        Index('idx_weather_data_date_station', 'date', 'station_id'),
    )


class WeatherForecast(Base):
    __tablename__ = "weather_forecast"
    id = Column(Integer, primary_key=True, index=True)
    forecast_date = Column(Date, nullable=False, unique=True)
    avg_temp = Column(Numeric(5, 2))
    max_temp = Column(Numeric(5, 2))
    min_temp = Column(Numeric(5, 2))
    precipitation = Column(Numeric(6, 2))
    humidity = Column(Numeric(5, 2))
    forecast_type = Column(String(20), default='short_term')
    created_at = Column(TIMESTAMP, server_default=func.now())
    __table_args__ = (
        Index('idx_weather_forecast_date', 'forecast_date'),
    )
