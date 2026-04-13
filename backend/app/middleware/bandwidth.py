"""
Bandwidth Limit Middleware — Rate-limits automation routes by IP.
Enforces 10MB/hour incoming and 10MB/hour outgoing per IP address
on /api/automation/ endpoints to prevent abuse.
"""

import time
import logging
from collections import defaultdict
from threading import Lock
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)


class BandwidthRateLimiter:
    LIMIT_BYTES = 10 * 1024 * 1024  # 10MB
    WINDOW_SECONDS = 3600  # 1 hour

    def __init__(self):
        self._lock = Lock()
        self._incoming: dict[str, list[tuple[float, int]]] = defaultdict(list)
        self._outgoing: dict[str, list[tuple[float, int]]] = defaultdict(list)

    def _cleanup_old(self, records: list[tuple[float, int]], now: float) -> list[tuple[float, int]]:
        cutoff = now - self.WINDOW_SECONDS
        return [(ts, size) for ts, size in records if ts > cutoff]

    def _get_total(self, records: list[tuple[float, int]]) -> int:
        return sum(size for _, size in records)

    def check_incoming(self, ip: str, size: int) -> tuple[bool, int, int]:
        now = time.time()
        with self._lock:
            self._incoming[ip] = self._cleanup_old(self._incoming[ip], now)
            current = self._get_total(self._incoming[ip])
            remaining = max(0, self.LIMIT_BYTES - current)
            if current + size > self.LIMIT_BYTES:
                return False, current, remaining
            return True, current, remaining

    def record_incoming(self, ip: str, size: int):
        now = time.time()
        with self._lock:
            self._incoming[ip].append((now, size))

    def check_outgoing(self, ip: str, size: int) -> tuple[bool, int, int]:
        now = time.time()
        with self._lock:
            self._outgoing[ip] = self._cleanup_old(self._outgoing[ip], now)
            current = self._get_total(self._outgoing[ip])
            remaining = max(0, self.LIMIT_BYTES - current)
            if current + size > self.LIMIT_BYTES:
                return False, current, remaining
            return True, current, remaining

    def record_outgoing(self, ip: str, size: int):
        now = time.time()
        with self._lock:
            self._outgoing[ip].append((now, size))

    def get_usage(self, ip: str) -> dict:
        now = time.time()
        with self._lock:
            self._incoming[ip] = self._cleanup_old(self._incoming[ip], now)
            self._outgoing[ip] = self._cleanup_old(self._outgoing[ip], now)
            in_used = self._get_total(self._incoming[ip])
            out_used = self._get_total(self._outgoing[ip])
        return {
            "ip": ip,
            "incoming_used_bytes": in_used,
            "incoming_remaining_bytes": max(0, self.LIMIT_BYTES - in_used),
            "outgoing_used_bytes": out_used,
            "outgoing_remaining_bytes": max(0, self.LIMIT_BYTES - out_used),
            "limit_bytes": self.LIMIT_BYTES,
            "window_seconds": self.WINDOW_SECONDS
        }


bandwidth_limiter = BandwidthRateLimiter()


class BandwidthLimitMiddleware(BaseHTTPMiddleware):
    AUTOMATION_PREFIX = '/api/automation/'

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if not path.startswith(self.AUTOMATION_PREFIX):
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        content_length = request.headers.get('content-length', '0')
        try:
            incoming_size = int(content_length)
        except ValueError:
            incoming_size = 0

        if incoming_size > 0:
            allowed, used, remaining = bandwidth_limiter.check_incoming(client_ip, incoming_size)
            if not allowed:
                logger.warning(f"[BANDWIDTH] REJECTED incoming | IP={client_ip} | path={path} | size={incoming_size} | used={used}")
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "Bandwidth limit exceeded",
                        "detail": f"Incoming limit: {bandwidth_limiter.LIMIT_BYTES / 1024 / 1024:.0f}MB/hour",
                        "used_bytes": used, "remaining_bytes": remaining
                    },
                    headers={"Retry-After": "3600"}
                )
            bandwidth_limiter.record_incoming(client_ip, incoming_size)

        response = await call_next(request)

        response_body = b""
        async for chunk in response.body_iterator:
            response_body += chunk

        outgoing_size = len(response_body)
        if outgoing_size > 0:
            allowed, used, remaining = bandwidth_limiter.check_outgoing(client_ip, outgoing_size)
            if not allowed:
                logger.warning(f"[BANDWIDTH] REJECTED outgoing | IP={client_ip} | path={path} | size={outgoing_size} | used={used}")
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "Bandwidth limit exceeded",
                        "detail": f"Outgoing limit: {bandwidth_limiter.LIMIT_BYTES / 1024 / 1024:.0f}MB/hour",
                        "used_bytes": used, "remaining_bytes": remaining
                    },
                    headers={"Retry-After": "3600"}
                )
            bandwidth_limiter.record_outgoing(client_ip, outgoing_size)

        return Response(
            content=response_body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type
        )
