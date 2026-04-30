# backend/app/main.py
import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.logging_config import get_logger, setup_logging
from app.core.worker import app as procrastinate_app
from app.middleware.error_handler import (
    generic_exception_handler,
    sqlalchemy_exception_handler,
    validation_exception_handler,
)
from app.middleware.performance import PerformanceMiddleware
from app.middleware.pipeline_context import PipelineContextMiddleware
from app.middleware.rate_limit import RateLimitMiddleware, close_redis_rate_limiter
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.middleware.telemetry import TelemetryMiddleware, drain_pending_audit_tasks

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info(f"Starting {settings.PROJECT_NAME} in {settings.ENVIRONMENT} mode")

    from app.core.startup_checks import run_startup_checks

    run_startup_checks()

    if settings.ENVIRONMENT != "testing":
        await procrastinate_app.open_async()
    rt_listener_task: asyncio.Task[None] | None = None
    if settings.ENVIRONMENT != "testing":
        from app.services.realtime_pg_notify import run_pg_notify_listener

        rt_listener_task = asyncio.create_task(run_pg_notify_listener())
    try:
        yield
    finally:
        if rt_listener_task is not None:
            rt_listener_task.cancel()
            with suppress(asyncio.CancelledError):
                await rt_listener_task
        await drain_pending_audit_tasks()
        await close_redis_rate_limiter()
        if settings.ENVIRONMENT != "testing":
            await procrastinate_app.close_async()
        logger.info("Shutting down gracefully")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description=(
            "AI-Native Master Foundation API with cognitive routing, HITL decisions, "
            "and real-time updates"
        ),
        version="0.1.0",
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url=f"{settings.API_V1_STR}/docs",
        redoc_url=f"{settings.API_V1_STR}/redoc",
        lifespan=lifespan,
        default_response_class=JSONResponse,
    )

    # First added = innermost (closest to routes). Pipeline reads request_id from outer stack.
    app.add_middleware(PipelineContextMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(PerformanceMiddleware, slow_request_threshold_ms=1000.0)
    app.add_middleware(RequestIDMiddleware)
    # Rate limiting runs before telemetry so 429s are captured in the audit log
    app.add_middleware(RateLimitMiddleware, requests_per_minute=120)
    app.add_middleware(TelemetryMiddleware)

    # Register exception handlers
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(ValidationError, validation_exception_handler)
    app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)

    # CORS: merge `.env` with localhost / 127.0.0.1 on 3000 and 3001 so dev ports never break.
    _cors_origins = list(
        dict.fromkeys(
            [
                *settings.cors_origins_list(),
                "http://localhost:3000",
                "http://localhost:3001",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
            ]
        )
    )
    _cors: dict[str, object] = {
        "allow_origins": _cors_origins,
        "allow_credentials": True,
        "allow_methods": ["*"],
        "allow_headers": ["*"],
    }
    if settings.ENVIRONMENT in ("development", "staging"):
        _cors["allow_origin_regex"] = r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"
    _cors["expose_headers"] = [
        "X-Request-ID",
        "X-Process-Time",
        "X-Pipeline-Root",
        "X-Feature-Pipeline",
    ]
    app.add_middleware(CORSMiddleware, **_cors)

    app.include_router(api_router, prefix=settings.API_V1_STR)

    return app


app = create_app()
