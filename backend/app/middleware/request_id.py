"""
Request ID middleware for tracking requests across services.
"""
import uuid
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Adds a unique request ID to each request for tracking and debugging.
    If X-Request-ID header is present, it will be used; otherwise a new UUID is generated.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request and add request ID to headers."""
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        return response
