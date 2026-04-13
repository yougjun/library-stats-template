"""
Application Factory — Creates and configures the FastAPI application.
Sets up CORS, middleware, rate limiting, Socket.IO, and registers all routes.
This is the single entrypoint: `uvicorn app.main:socket_app --port 3112`
"""

import logging
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import socketio
from jose import jwt

from app.config import Config
from app.models.base import engine, Base
from app.utils.logging_config import setup_logging
from app.middleware.logging import RequestLoggingMiddleware, HealthCheckFilter
from app.middleware.bandwidth import BandwidthLimitMiddleware
from app.routes import register_routes

setup_logging()
logger = logging.getLogger(__name__)

for handler in logging.getLogger().handlers:
    handler.addFilter(HealthCheckFilter())

Base.metadata.create_all(bind=engine)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Library Statistics API",
    docs_url="/docs" if Config.is_development() else None,
    redoc_url="/redoc" if not Config.is_production() else None,
    openapi_url="/openapi.json" if Config.is_development() else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = Config.CORS_ORIGINS.split(",")
if Config.is_production():
    origins = [o for o in origins if o.startswith("https://")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(BandwidthLimitMiddleware)

register_routes(app)


# --- Socket.IO ---

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="/socket.io")


async def _verify_socket_token(environ: dict) -> dict:
    token = None

    if "socketio" in environ and "auth" in environ["socketio"]:
        auth_data = environ["socketio"]["auth"]
        token = auth_data.get("token") if isinstance(auth_data, dict) else None

    if not token:
        qs = environ.get("QUERY_STRING", "")
        if qs:
            params = dict(p.split("=") for p in qs.split("&") if "=" in p)
            token = params.get("token")

    if not token:
        auth_header = environ.get("HTTP_AUTHORIZATION", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]

    if not token:
        return {"role": "guest", "code": "anonymous"}

    try:
        payload = jwt.decode(token, Config.SECRET_KEY, algorithms=[Config.ALGORITHM])
        return {"role": payload.get("role", "guest"), "code": payload.get("code", "anonymous")}
    except Exception:
        return {"role": "guest", "code": "anonymous"}


@sio.event
async def connect(sid, environ):
    user_data = await _verify_socket_token(environ)
    async with sio.session(sid) as session:
        session["user"] = user_data
    logger.info(f"Client connected: {sid}")
    await sio.emit("connected", {"sid": sid}, room=sid)


@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")
    try:
        from app.services.chat.service import cleanup_session
        cleanup_session(sid)
    except Exception:
        pass


@sio.event
async def join_room(sid, data):
    async with sio.session(sid) as session:
        user = session.get("user")
        if not user:
            return
    room = data.get("room")
    if room:
        await sio.enter_room(sid, room)


@sio.event
async def leave_room(sid, data):
    async with sio.session(sid) as session:
        user = session.get("user")
        if not user:
            return
    room = data.get("room")
    if room:
        await sio.leave_room(sid, room)


@app.on_event("startup")
async def preload_nlu_models():
    def _preload():
        try:
            from app.services.chat.nlu import preload_models
            preload_models()
            logger.info("NLU models preloaded successfully")
        except Exception as e:
            logger.warning(f"Failed to preload NLU models: {e}")

    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _preload)
