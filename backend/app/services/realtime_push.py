# backend/app/services/realtime_push.py
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def push_realtime_to_api(user_id: str, message: dict[str, Any]) -> None:
    """
    Notify the API process (which holds WebSocket connections). Workers run in a
    separate process and cannot use the in-memory ConnectionManager.
    """
    base = settings.REALTIME_PUSH_BASE_URL.rstrip("/")
    path = f"{settings.API_V1_STR}/realtime/internal/push"
    url = f"{base}{path}"
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                url,
                json={"user_id": user_id, "message": message},
                headers={
                    "X-Internal-Realtime-Secret": settings.INTERNAL_REALTIME_SECRET,
                },
                timeout=15.0,
            )
            r.raise_for_status()
    except Exception:
        logger.exception(
            "Realtime push failed for user %s (URL=%s)", user_id, url
        )
