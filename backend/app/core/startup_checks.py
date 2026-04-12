"""
Startup validation checks to ensure the application is properly configured.
"""
import sys

from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)


def validate_environment() -> bool:
    """
    Validate critical environment variables and configuration.
    Returns True if all checks pass, False otherwise.
    """
    errors = []

    if settings.ENVIRONMENT == "production":
        if settings.JWT_SECRET == "change-me-in-production-min-32-chars":
            errors.append("JWT_SECRET must be changed in production")
        elif len(settings.JWT_SECRET) < 32:
            errors.append("JWT_SECRET must be at least 32 characters")

    if not settings.POSTGRES_SERVER:
        errors.append("POSTGRES_SERVER is not configured")

    if not settings.POSTGRES_USER:
        errors.append("POSTGRES_USER is not configured")

    if not settings.POSTGRES_PASSWORD:
        errors.append("POSTGRES_PASSWORD is not configured")

    if not settings.POSTGRES_DB:
        errors.append("POSTGRES_DB is not configured")

    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY is not configured - AI features will not work")

    if settings.STORAGE_BACKEND == "s3":
        if not settings.S3_BUCKET_NAME:
            errors.append("S3_BUCKET_NAME is required when using S3 storage")
        if not settings.S3_REGION:
            errors.append("S3_REGION is required when using S3 storage")

    if errors:
        logger.error("Environment validation failed:")
        for error in errors:
            logger.error(f"  - {error}")
        return False

    logger.info("Environment validation passed")
    return True


def run_startup_checks() -> None:
    """
    Run all startup checks and exit if any critical checks fail.
    """
    logger.info("Running startup checks...")

    if not validate_environment():
        logger.error("Startup checks failed. Exiting.")
        sys.exit(1)

    logger.info("All startup checks passed")
