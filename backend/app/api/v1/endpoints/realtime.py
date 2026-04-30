# backend/app/api/v1/endpoints/realtime.py
import logging
import uuid

from fastapi import (
    APIRouter,
    Header,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.schemas.realtime import RealtimeInternalPush
from app.services.realtime import manager
from app.services.realtime_pg_notify import publish_internal_realtime_event

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str | None = Query(None, description="Target user UUID (must exist and be active)."),
) -> None:
    """Real-time bus. Pass user_id query (no JWT)."""
    if not user_id:
        await websocket.close(code=1008)
        return
    try:
        uid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        await websocket.close(code=1008)
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(
                User.id == uid,
                User.is_active.is_(True),
                User.is_deleted.is_(False),
            )
        )
        user = result.scalar_one_or_none()
    if not user:
        await websocket.close(code=1008)
        return

    key = str(uid)
    await manager.connect(key, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(key, websocket)


@router.post("/internal/push", status_code=status.HTTP_204_NO_CONTENT)
async def internal_realtime_push(
    body: RealtimeInternalPush,
    x_internal_realtime_secret: str = Header(..., alias="X-Internal-Realtime-Secret"),
) -> None:
    """
    Called by the Procrastinate worker (separate process) to deliver events to
    WebSocket clients. Uses Postgres NOTIFY so all Gunicorn workers see the event.
    """
    if x_internal_realtime_secret != settings.INTERNAL_REALTIME_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid secret")

    if settings.ENVIRONMENT == "testing":
        await manager.send_personal_message(body.user_id, body.message)
        return

    try:
        await publish_internal_realtime_event(body.user_id, body.message)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(e),
        ) from e
