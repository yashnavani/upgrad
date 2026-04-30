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

    if settings.ENVIRONMENT == "production" and not settings.SYSTEM_ACTOR_USER_ID:
        errors.append("SYSTEM_ACTOR_USER_ID must be set in production")
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

    la_key = (settings.LIVEAVATAR_API_KEY or "").strip()
    la_id = (settings.LIVEAVATAR_AVATAR_ID or "").strip()
    if bool(la_key) ^ bool(la_id):
        logger.warning(
            "LiveAvatar: set both LIVEAVATAR_API_KEY and LIVEAVATAR_AVATAR_ID "
            "(or leave both empty for text-only interviews)."
        )

    if settings.ENVIRONMENT in ("staging", "production") and not (
        settings.REDIS_URL or ""
    ).strip():
        logger.warning(
            "REDIS_URL is not set: rate limits are per-process only "
            "(not shared across Gunicorn workers or replicas). "
            "Set REDIS_URL for distributed limits."
        )

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
