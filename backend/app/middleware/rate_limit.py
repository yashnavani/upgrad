"""
Rate limiting: optional Redis (shared across workers); in-memory fallback per process.
"""
import asyncio
import time
from collections import defaultdict
from collections.abc import Callable
from typing import Any

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

_redis_client: Any = None
_redis_lock = asyncio.Lock()


async def close_redis_rate_limiter() -> None:
    """Close the shared Redis client (call from app lifespan shutdown)."""
    global _redis_client
    if _redis_client is not None:
        try:
            await _redis_client.aclose()
        except Exception:
            logger.exception("Failed to close Redis rate limit client")
        _redis_client = None


async def _redis_for_rate_limit() -> Any | None:
    global _redis_client
    url = (settings.REDIS_URL or "").strip()
    if not url:
        return None
    async with _redis_lock:
        if _redis_client is None:
            import redis.asyncio as redis

            client = redis.from_url(url, decode_responses=True)
            try:
                await client.ping()
            except Exception:
                logger.warning(
                    "Redis unreachable for rate limiting; using in-memory fallback",
                    exc_info=True,
                )
                await client.aclose()
                return None
            _redis_client = client
    return _redis_client


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Fixed window per minute. With REDIS_URL, counts are shared across all workers.
    Without Redis, each process keeps its own window (underestimates global traffic).
    """

    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.window_size = 60
        self.clients: dict[str, list[float]] = defaultdict(list)

    def _get_client_id(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _is_rate_limited_memory(self, client_id: str) -> bool:
        now = time.time()
        window_start = now - self.window_size

        requests = self.clients[client_id]
        requests[:] = [req_time for req_time in requests if req_time > window_start]

        if len(requests) >= self.requests_per_minute:
            return True

        requests.append(now)
        return False

    async def _is_rate_limited_redis(self, client_id: str, redis: Any) -> bool:
        minute_bucket = int(time.time()) // 60
        key = f"ratelimit:{client_id}:{minute_bucket}"
        try:
            n = await redis.incr(key)
            if n == 1:
                await redis.expire(key, self.window_size + 5)
            return n > self.requests_per_minute
        except Exception:
            logger.warning("Redis rate limit error; allowing request", exc_info=True)
            return False

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if settings.ENVIRONMENT in ("development", "testing"):
            return await call_next(request)

        if request.url.path in {
            "/api/v1/health",
            "/api/v1/health/detailed",
            "/api/v1/metrics",
            f"{settings.API_V1_STR}/docs",
            f"{settings.API_V1_STR}/openapi.json",
            f"{settings.API_V1_STR}/redoc",
        }:
            return await call_next(request)

        client_id = self._get_client_id(request)

        redis = await _redis_for_rate_limit()
        if redis is not None:
            if await self._is_rate_limited_redis(client_id, redis):
                logger.warning("Rate limit exceeded for client: %s (redis)", client_id)
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "detail": (
                            f"Rate limit exceeded. Maximum {self.requests_per_minute} "
                            "requests per minute."
                        )
                    },
                )
        else:
            if self._is_rate_limited_memory(client_id):
                logger.warning("Rate limit exceeded for client: %s (memory)", client_id)
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "detail": (
                            f"Rate limit exceeded. Maximum {self.requests_per_minute} "
                            "requests per minute."
                        )
                    },
                )

        return await call_next(request)
