# backend/app/main.py
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.worker import app as procrastinate_app
from app.middleware.telemetry import TelemetryMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    await procrastinate_app.open_async()
    print(f"Starting {settings.PROJECT_NAME} in {settings.ENVIRONMENT} mode.")
    try:
        yield
    finally:
        await procrastinate_app.close_async()
        print("Shutting down gracefully.")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        lifespan=lifespan,
        default_response_class=JSONResponse,
    )

    app.add_middleware(TelemetryMiddleware)

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

    # Basic Health Check Route
    @app.get("/health", tags=["System"])
    async def health_check():
        return {
            "status": "online",
            "environment": settings.ENVIRONMENT,
            "project": settings.PROJECT_NAME,
        }

    @app.get("/api/v1/test-logger", tags=["System"])
    async def test_logger():
        return {"message": "This request was just logged to the database automatically!"}

    app.include_router(api_router, prefix=settings.API_V1_STR)

    return app


app = create_app()
