"""
Logging Configuration — Structured JSON logging with file rotation.
Sets up console (human-readable) and JSON file handlers for app and error logs.
"""

import logging
import sys
from pythonjsonlogger import jsonlogger
from pathlib import Path

from app.config import config


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super(CustomJsonFormatter, self).add_fields(log_record, record, message_dict)
        log_record['service'] = 'library-stats-backend'
        log_record['environment'] = config.ENVIRONMENT
        if not log_record.get('timestamp'):
            log_record['timestamp'] = record.created


def setup_logging(log_level=logging.INFO):
    log_dir = config.LOG_DIR
    log_dir.mkdir(exist_ok=True)

    json_formatter = CustomJsonFormatter(
        '%(timestamp)s %(level)s %(name)s %(message)s %(pathname)s %(lineno)d'
    )
    console_formatter = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(name)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers.clear()

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)

    json_file_handler = logging.FileHandler(log_dir / "app.json.log")
    json_file_handler.setLevel(log_level)
    json_file_handler.setFormatter(json_formatter)
    root_logger.addHandler(json_file_handler)

    error_file_handler = logging.FileHandler(log_dir / "error.json.log")
    error_file_handler.setLevel(logging.ERROR)
    error_file_handler.setFormatter(json_formatter)
    root_logger.addHandler(error_file_handler)

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    return root_logger


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
