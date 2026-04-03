# backend/app/middleware/telemetry.py
import asyncio
import time

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.services.audit import write_audit_log_async

# Paths we don't want to clutter the audit log with
EXCLUDED_PATHS = {"/health", "/metrics", "/favicon.ico"}


class TelemetryMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip logging for health checks to save DB space
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

            asyncio.create_task(
                write_audit_log_async(
                    endpoint=path,
                    http_method=request.method,
                    status_code=status_code,
                    processing_time_ms=process_time_ms,
                    client_ip=client_ip,
                    user_agent=user_agent,
                    actor_id=actor_id,
                )
            )

        return response
