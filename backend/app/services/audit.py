# backend/app/services/audit.py
import logging

from app.core.database import AsyncSessionLocal
from app.models.audit import AuditLog

logger = logging.getLogger(__name__)


async def write_audit_log_async(
    endpoint: str,
    http_method: str,
    status_code: int,
    processing_time_ms: float,
    client_ip: str | None = None,
    user_agent: str | None = None,
    actor_id: str | None = None,
    action_name: str | None = None,
    resource_id: str | None = None,
    extra_data: dict | None = None,
):
    """
    Writes an audit log to the database asynchronously.
    Designed to be run as a background task.
    """
    async with AsyncSessionLocal() as db:
        try:
            log_entry = AuditLog(
                endpoint=endpoint,
                http_method=http_method,
                status_code=status_code,
                processing_time_ms=processing_time_ms,
                client_ip=client_ip,
                user_agent=user_agent,
                actor_id=actor_id,
                action_name=action_name,
                resource_id=resource_id,
                extra_data=extra_data,
            )
            db.add(log_entry)
            await db.commit()
        except Exception as e:
            # We fail silently and log to stdout because audit failures
            # should never crash the main application workflow.
            logger.error("Failed to write audit log: %s", e)
