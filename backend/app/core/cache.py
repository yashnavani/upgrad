"""
Simple in-memory caching utility.
For production, replace with Redis-backed caching.
"""
import asyncio
import time
from collections.abc import Callable
from typing import Any, TypeVar

from app.core.logging_config import get_logger

logger = get_logger(__name__)

T = TypeVar("T")

_cache: dict[str, tuple[Any, float]] = {}
_cache_lock = asyncio.Lock()


async def get_cached(key: str, ttl_seconds: int = 300) -> Any | None:
    """
    Get value from cache if not expired.

    Args:
        key: Cache key
        ttl_seconds: Time to live in seconds

    Returns:
        Cached value or None if expired/not found
    """
    async with _cache_lock:
        if key in _cache:
            value, timestamp = _cache[key]
            if time.time() - timestamp < ttl_seconds:
                logger.debug(f"Cache hit: {key}")
                return value
            else:
                logger.debug(f"Cache expired: {key}")
                del _cache[key]
        return None


async def set_cached(key: str, value: Any) -> None:
    """
    Set value in cache with current timestamp.

    Args:
        key: Cache key
        value: Value to cache
    """
    async with _cache_lock:
        _cache[key] = (value, time.time())
        logger.debug(f"Cache set: {key}")


async def delete_cached(key: str) -> None:
    """
    Delete value from cache.

    Args:
        key: Cache key
    """
    async with _cache_lock:
        if key in _cache:
            del _cache[key]
            logger.debug(f"Cache deleted: {key}")


async def clear_cache() -> None:
    """Clear all cached values."""
    async with _cache_lock:
        _cache.clear()
        logger.info("Cache cleared")


def cached(ttl_seconds: int = 300, key_prefix: str = ""):
    """
    Decorator for caching async function results.

    Args:
        ttl_seconds: Time to live in seconds
        key_prefix: Prefix for cache key

    Example:
        @cached(ttl_seconds=60, key_prefix="user")
        async def get_user(user_id: int):
            return await db.get(user_id)
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            cache_key = f"{key_prefix}:{func.__name__}:{args}:{kwargs}"

            cached_value = await get_cached(cache_key, ttl_seconds)
            if cached_value is not None:
                return cached_value

            result = await func(*args, **kwargs)
            await set_cached(cache_key, result)
            return result

        return wrapper

    return decorator
