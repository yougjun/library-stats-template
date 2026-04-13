"""
Security Middleware — HTTP security headers and IP whitelist enforcement.
Adds standard security headers (X-Frame-Options, X-Content-Type-Options, etc.)
and enforces IP whitelist + HTTPS requirements in production.
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.config import config
from app.services.auth import check_ip_whitelist


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response


class SecurityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/socket.io"):
            return await call_next(request)

        if request.url.path != "/health":
            check_ip_whitelist(request)

        if config.is_production() and request.url.scheme != "https":
            return JSONResponse(status_code=403, content={"detail": "HTTPS required"})

        return await call_next(request)
