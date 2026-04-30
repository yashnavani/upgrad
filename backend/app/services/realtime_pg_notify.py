# backend/app/services/realtime_pg_notify.py
"""Cross-worker realtime fan-out via Postgres NOTIFY (all API workers LISTEN).

Gunicorn runs multiple Uvicorn workers; each holds its own in-memory WebSocket map.
Internal HTTP push lands on one worker; NOTIFY reaches every worker so the one
that owns the socket can deliver. Payload must stay under Postgres NOTIFY limits (~8KB).
"""
import asyncio
import contextlib
import json
import logging
from typing import Any

import asyncpg

from app.core.config import settings

logger = logging.getLogger(__name__)

REALTIME_NOTIFY_CHANNEL = "mf_realtime_push"
_MAX_NOTIFY_BYTES = 7500


def _asyncpg_dsn() -> str:
    return str(settings.SQLALCHEMY_DATABASE_URI).replace(
        "postgresql+asyncpg", "postgresql", 1
    )


async def publish_internal_realtime_event(user_id: str, message: dict[str, Any]) -> None:
    payload = json.dumps({"user_id": user_id, "message": message}, separators=(",", ":"))
    if len(payload.encode("utf-8")) > _MAX_NOTIFY_BYTES:
        raise ValueError(
            f"realtime NOTIFY payload too large (max {_MAX_NOTIFY_BYTES} bytes)"
        )
    conn = await asyncpg.connect(dsn=_asyncpg_dsn())
    try:
        await conn.execute(
            "SELECT pg_notify($1::text, $2::text)",
            REALTIME_NOTIFY_CHANNEL,
            payload,
        )
    finally:
        await conn.close()


async def _on_pg_notification(
    connection: asyncpg.Connection,
    pid: int,
    channel: str,
    payload: str | None,
) -> None:
    del connection, pid, channel
    if not payload:
        return
    from app.services.realtime import manager

    try:
        data = json.loads(payload)
        uid = str(data["user_id"])
        msg = data["message"]
        await manager.send_personal_message(uid, msg)
    except Exception:
        logger.exception("Failed to dispatch realtime NOTIFY payload")


_listen_connection: asyncpg.Connection | None = None


async def run_pg_notify_listener() -> None:
    """Block until cancelled; forwards NOTIFY payloads to the local ConnectionManager."""
    global _listen_connection
    conn = await asyncpg.connect(dsn=_asyncpg_dsn())
    _listen_connection = conn
    await conn.add_listener(REALTIME_NOTIFY_CHANNEL, _on_pg_notification)
    try:
        await asyncio.Future()
    except asyncio.CancelledError:
        raise
    finally:
        with contextlib.suppress(AttributeError, TypeError):
            await conn.remove_listener(REALTIME_NOTIFY_CHANNEL, _on_pg_notification)
        try:
            await conn.close()
        except Exception:
            logger.exception("realtime PG listener shutdown cleanup failed")
        finally:
            _listen_connection = None

