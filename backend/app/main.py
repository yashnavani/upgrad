# backend/app/main.py
from contextlib import asynccontextmanager

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
from app.middleware.request_id import RequestIDMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.middleware.telemetry import TelemetryMiddleware

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info(f"Starting {settings.PROJECT_NAME} in {settings.ENVIRONMENT} mode")
    
    from app.core.startup_checks import run_startup_checks
    run_startup_checks()
    
    await procrastinate_app.open_async()
    try:
        yield
    finally:
        await procrastinate_app.close_async()
        logger.info("Shutting down gracefully")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description="AI-Native Master Foundation API with cognitive routing, HITL decisions, and real-time updates",
        version="0.1.0",
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url=f"{settings.API_V1_STR}/docs",
        redoc_url=f"{settings.API_V1_STR}/redoc",
        lifespan=lifespan,
        default_response_class=JSONResponse,
    )

    # Add middleware (order matters - first added is outermost)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(PerformanceMiddleware, slow_request_threshold_ms=1000.0)
    app.add_middleware(RequestIDMiddleware)
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
    if settings.ENVIRONMENT == "development":
        _cors["allow_origin_regex"] = r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"
    app.add_middleware(CORSMiddleware, **_cors)

    app.include_router(api_router, prefix=settings.API_V1_STR)

    return app


app = create_app()
