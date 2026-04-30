# backend/app/middleware/telemetry.py
import asyncio
import time
from typing import Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging_config import get_logger
from app.services.audit import write_audit_log_async

logger = get_logger(__name__)

EXCLUDED_PATHS = {
    "/api/v1/health",
    "/api/v1/health/detailed",
    "/api/v1/metrics",
    "/favicon.ico",
}

_pending_audit_tasks: set[asyncio.Task[Any]] = set()


def schedule_audit_log_write(**kwargs: Any) -> None:
    """Fire-and-forget audit write with error isolation; task tracked for graceful shutdown."""

    async def _runner() -> None:
        try:
            await write_audit_log_async(**kwargs)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Background audit log write failed")

    task = asyncio.create_task(_runner())
    _pending_audit_tasks.add(task)
    task.add_done_callback(_pending_audit_tasks.discard)


async def drain_pending_audit_tasks(timeout: float = 5.0) -> None:
    """Wait for in-flight audit tasks (best-effort) before closing the process."""
    if not _pending_audit_tasks:
        return
    pending = set(_pending_audit_tasks)
    _, still = await asyncio.wait(pending, timeout=timeout)
    for t in still:
        t.cancel()
    if still:
        await asyncio.gather(*still, return_exceptions=True)


class TelemetryMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if path in EXCLUDED_PATHS:
            return await call_next(request)

        start_time = time.perf_counter()
        response = None
        status_code = 500

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception:
            status_code = 500
            raise
        finally:
            process_time_ms = (time.perf_counter() - start_time) * 1000

            forwarded_for = request.headers.get("x-forwarded-for")
            if forwarded_for:
                client_ip = forwarded_for.split(",")[0].strip()
            elif request.client:
                client_ip = request.client.host
            else:
                client_ip = None

            user_agent = request.headers.get("user-agent")

            actor_id = None
            if hasattr(request.state, "user") and request.state.user:
                uid = getattr(request.state.user, "id", None)
                actor_id = str(uid) if uid is not None else None

            rid = getattr(request.state, "request_id", None)
            proot = getattr(request.state, "pipeline_root_id", None)
            feat = getattr(request.state, "feature_pipeline", None)
            extra = {}
            if rid:
                extra["request_id"] = rid
            if proot:
                extra["pipeline_root"] = proot
            if feat:
                extra["feature_pipeline"] = feat

            schedule_audit_log_write(
                endpoint=path,
                http_method=request.method,
                status_code=status_code,
                processing_time_ms=process_time_ms,
                client_ip=client_ip,
                user_agent=user_agent,
                actor_id=actor_id,
                extra_data=extra or None,
            )

        return response
