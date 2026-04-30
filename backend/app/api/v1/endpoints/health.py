"""
Enhanced health check endpoints with dependency monitoring.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.config import settings
from app.core.logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)


class HealthResponse(BaseModel):
    status: str
    environment: str
    project: str
    database: str
    version: str = "0.1.0"


class DetailedHealthResponse(BaseModel):
    status: str
    environment: str
    project: str
    checks: dict[str, dict[str, str | bool]]


@router.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """Basic health check with database connectivity test."""
    db_status = "healthy"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = "unhealthy"

    return {
        "status": "online",
        "environment": settings.ENVIRONMENT,
        "project": settings.PROJECT_NAME,
        "database": db_status,
    }


@router.get("/health/detailed", response_model=DetailedHealthResponse, tags=["System"])
async def detailed_health_check(db: AsyncSession = Depends(get_db)):
    """Detailed health check with all dependencies."""
    checks = {}

    checks["database"] = await _check_database(db)
    checks["gemini_api"] = _check_gemini_config()
    checks["storage"] = _check_storage_config()

    overall_status = "healthy" if all(c["healthy"] for c in checks.values()) else "degraded"

    return {
        "status": overall_status,
        "environment": settings.ENVIRONMENT,
        "project": settings.PROJECT_NAME,
        "checks": checks,
    }


async def _check_database(db: AsyncSession) -> dict[str, str | bool]:
    """Check database connectivity and basic operations."""
    try:
        result = await db.execute(text("SELECT version()"))
        version = result.scalar_one()
        return {
            "healthy": True,
            "message": "Database connected",
            "version": version[:50] if version else "unknown",
        }
    except Exception as e:
        logger.error(f"Database check failed: {e}")
        return {"healthy": False, "message": f"Database error: {str(e)[:100]}"}


def _check_gemini_config() -> dict[str, str | bool]:
    """Check if Gemini API is configured."""
    if settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 10:
        return {"healthy": True, "message": "Gemini API configured"}
    return {"healthy": False, "message": "Gemini API key not configured"}


def _check_storage_config() -> dict[str, str | bool]:
    """Check storage configuration."""
    if settings.STORAGE_BACKEND == "local":
        return {
            "healthy": True,
            "message": f"Local storage configured at {settings.LOCAL_STORAGE_PATH}",
        }
    elif settings.STORAGE_BACKEND == "s3":
        if settings.S3_BUCKET_NAME:
            return {"healthy": True, "message": f"S3 storage configured: {settings.S3_BUCKET_NAME}"}
        return {"healthy": False, "message": "S3 storage selected but not configured"}
    return {"healthy": False, "message": "Unknown storage backend"}
