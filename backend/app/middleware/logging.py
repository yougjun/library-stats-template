"""
Request Logging Middleware — Logs all HTTP requests with timing and metadata.
Also provides HealthCheckFilter to suppress noisy /health endpoint logs.
"""

import time
import logging
import traceback
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    LOGGED_ENDPOINTS = ['/api/automation/', '/api/template-driven/']

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        request_id = request.headers.get('X-Request-ID', f"{time.time()}")
        client_ip = request.client.host if request.client else "unknown"
        query_params = str(request.query_params) if request.query_params else ""

        log_extra = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "client_ip": client_ip,
            "user_agent": request.headers.get("user-agent", ""),
        }
        if query_params:
            log_extra["query_params"] = query_params

        logger.info("Incoming request", extra=log_extra)

        try:
            response = await call_next(request)
            duration = time.time() - start_time

            logger.info(
                "Request completed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": round(duration * 1000, 2),
                    "client_ip": client_ip,
                }
            )

            response.headers["X-Process-Time"] = str(duration)
            response.headers["X-Request-ID"] = request_id
            return response

        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                "Request failed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": round(duration * 1000, 2),
                    "error": str(e),
                    "traceback": traceback.format_exc(),
                },
                exc_info=True
            )
            raise


class HealthCheckFilter(logging.Filter):
    def filter(self, record):
        message = record.getMessage()
        return '/health' not in message
