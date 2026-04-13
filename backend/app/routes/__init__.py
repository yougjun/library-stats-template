"""
Route Registration — Aggregates all API routers into a single registration function.
Called from app.main to attach all endpoints to the FastAPI application.
"""

from fastapi import FastAPI


def register_routes(app: FastAPI) -> None:
    from app.routes.health import router as health_router
    from app.routes.auth import router as auth_router
    from app.routes.admin import router as admin_router
    from app.routes.settings import router as settings_router
    from app.routes.excel import router as excel_router
    from app.routes.automation import router as automation_router
    from app.routes.weather import router as weather_router
    from app.routes.chat import router as chat_router
    from app.routes.template_driven import router as template_driven_router

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(admin_router)
    app.include_router(settings_router)
    app.include_router(excel_router)
    app.include_router(automation_router)
    app.include_router(weather_router)
    app.include_router(chat_router)
    app.include_router(template_driven_router)
