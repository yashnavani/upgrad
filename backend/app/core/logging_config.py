"""
Centralized logging configuration for the application.
"""
import logging
import sys

from app.core.config import settings
from app.core.pipeline import feature_pipeline_var, pipeline_root_var


class _PipelineLogFilter(logging.Filter):
    """Injects pipeline_root + feature_pipeline from contextvars into LogRecord."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.pipeline_root = pipeline_root_var.get() or "-"
        record.feature_pipeline = feature_pipeline_var.get() or "-"
        return True


def setup_logging() -> None:
    """Configure application-wide logging with structured format."""
    log_level = logging.DEBUG if settings.ENVIRONMENT == "development" else logging.INFO

    # Create formatter
    formatter = logging.Formatter(
        fmt=(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s "
            "[root=%(pipeline_root)s feat=%(feature_pipeline)s]"
        ),
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    console_handler.addFilter(_PipelineLogFilter())
    root_logger.addHandler(console_handler)

    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)

    logging.info(f"Logging configured for {settings.ENVIRONMENT} environment")


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance for a module."""
    return logging.getLogger(name)
