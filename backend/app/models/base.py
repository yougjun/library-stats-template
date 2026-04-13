"""
Database Engine & Session — SQLAlchemy setup.
Creates engine, session factory, and declarative Base used by all model files.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.config import config

engine = create_engine(
    config.DATABASE_URL,
    pool_size=50,
    max_overflow=20,
    pool_timeout=30,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo_pool=config.is_development(),
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
