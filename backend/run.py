from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
import sys
from typing import Any, cast
from uuid import uuid4

from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, ai, auth, blockchain, dealer, inventory, manufacturer, tracking
from app.core.config import ConfigurationError, get_settings, validate_settings
from app.api.tracking import get_tracking_socket_payload
from app.services.ai_service import ai_status
from app.services.database_service import DatabaseError, check_database_connection, initialize_database
from app.services.notification_service import notification_service

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

logger = logging.getLogger("global_supply_chain_api")


def create_app() -> FastAPI:
    settings = get_settings()
    validate_settings(settings)
    initialize_database()

    app = FastAPI(title=settings.app_name)

    app.state.limiter = auth.limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_exception_handler(
        RateLimitExceeded,
        cast(Any, _rate_limit_exceeded_handler),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_origin_regex=settings.cors_origin_regex or None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, prefix="/api")
    app.include_router(admin.router, prefix="/api")
    app.include_router(ai.router, prefix="/api")
    app.include_router(manufacturer.router, prefix="/api")
    app.include_router(tracking.router, prefix="/api")
    app.include_router(blockchain.router, prefix="/api")
    app.include_router(dealer.router, prefix="/api")
    app.include_router(inventory.router, prefix="/api")

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "message": "Invalid request payload",
                "detail": exc.errors(),
            },
        )

    @app.exception_handler(DatabaseError)
    async def database_exception_handler(_: Request, exc: DatabaseError) -> JSONResponse:
        logger.exception("Database failure: %s", exc)
        return JSONResponse(
            status_code=503,
            content={
                "message": "Database temporarily unavailable",
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = uuid4().hex[:12]
        logger.exception(
            "Unhandled exception [%s] on %s %s: %s",
            request_id,
            request.method,
            request.url.path,
            exc,
        )
        return JSONResponse(
            status_code=500,
            content={
                "message": "Internal server error",
                "request_id": request_id,
            },
        )

    @app.get("/health", tags=["health"])
    def health_check(response: Response) -> dict:
        try:
            db_info = check_database_connection()
        except DatabaseError:
            response.status_code = 503
            return {
                "status": "degraded",
                "env": settings.app_env,
                "database": "unavailable",
                "email": {
                    "mock": settings.mock_email_delivery,
                    "smtp_server": settings.smtp_server,
                    "smtp_port": settings.smtp_port,
                "sender_email": settings.sender_email,
                "has_password": bool(settings.sender_password.strip()),
                },
                "ai": ai_status(),
            }

        return {
            "status": "ok",
            "env": settings.app_env,
            "database": "connected",
            "database_path": db_info["path"],
            "email": {
                "mock": settings.mock_email_delivery,
                "smtp_server": settings.smtp_server,
                "smtp_port": settings.smtp_port,
                "sender_email": settings.sender_email,
                "has_password": bool(settings.sender_password.strip()),
            },
            "ai": ai_status(),
        }

    @app.websocket("/ws/gps")
    async def gps_socket(websocket: WebSocket) -> None:
        await websocket.accept()
        try:
            while True:
                payload = get_tracking_socket_payload()
                await websocket.send_text(json.dumps(payload))
                await asyncio.sleep(2)
        except WebSocketDisconnect:
            return

    @app.websocket("/ws/notifications/{user_id}")
    async def notifications_socket(websocket: WebSocket, user_id: str) -> None:
        await notification_service.connect(user_id, websocket)
        try:
            recent = notification_service.list_recent(limit=20, user_id=user_id)
            await websocket.send_json({"type": "notification:init", "items": recent})
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            await notification_service.disconnect(user_id, websocket)

    return app


try:
    app = create_app()
except ConfigurationError as exc:
    logger.exception("Configuration error: %s", exc)
    raise RuntimeError(f"Configuration error: {exc}") from exc


if __name__ == "__main__":
    import os
    import uvicorn

    def can_bind(host_value: str, port_value: int) -> tuple[bool, OSError | None]:
        test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            test_socket.bind((host_value, port_value))
        except OSError as bind_error:
            return False, bind_error
        finally:
            test_socket.close()
        return True, None

    # Default reload OFF to avoid Windows reload instability and to keep in-memory OTP state stable.
    # Enable explicitly with: $env:UVICORN_RELOAD="true"
    default_reload = "false"
    reload_enabled = os.getenv("UVICORN_RELOAD", default_reload).strip().lower() in {"1", "true", "yes", "on"}
    render_port = (os.getenv("PORT") or "").strip()
    host = "0.0.0.0"  # Ensure Render can access the service
    port = int(os.getenv("UVICORN_PORT") or render_port or "8000")

    available, bind_error = can_bind(host, port)
    if not available:
        print(
            f"[startup] Cannot bind {host}:{port}. "
            f"This usually means another process is already using the port or access is blocked."
        )
        print(f"[startup] Original error: {bind_error}")
        print(f"[startup] Check current listener: netstat -ano | findstr :{port}")
        print("[startup] Run on another port: $env:UVICORN_PORT='8001'; python run.py")
        print(
            "[startup] If frontend is running, align proxy target: "
            "$env:VITE_DEV_PROXY_TARGET='http://127.0.0.1:8001'"
        )
        sys.exit(1)

    log_level = (os.getenv("UVICORN_LOG_LEVEL") or os.getenv("LOG_LEVEL") or "warning").strip().lower()
    access_log_enabled = (os.getenv("UVICORN_ACCESS_LOG") or "false").strip().lower() in {"1", "true", "yes", "on"}
    print(f"[startup] API listening on http://{host}:{port} (log_level={log_level}, access_log={access_log_enabled})")
    uvicorn.run(
        "run:app",  # Updated to use the correct module and app instance
        host="0.0.0.0",  # Bind to all interfaces
        port=port,
        reload=reload_enabled,
        log_level=log_level,
        access_log=access_log_enabled,
    )

    # Gunicorn command for deployment
    # gunicorn -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT

