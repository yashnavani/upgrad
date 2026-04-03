# backend/app/api/v1/endpoints/realtime.py
import logging

from fastapi import (
    APIRouter,
    Header,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)

from app.core.config import settings
from app.core.security import decode_access_token_for_websocket
from app.schemas.realtime import RealtimeInternalPush
from app.services.realtime import manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str | None = Query(None),
) -> None:
    """
    Real-time bus. JWT is passed as a query param because browsers cannot set
    custom headers on the WebSocket handshake.
    """
    if not token:
        await websocket.close(code=1008)
        return

    payload = decode_access_token_for_websocket(token)
    sub = payload.get("sub") if payload else None
    if not sub:
        await websocket.close(code=1008)
        return

    user_id = str(sub)
    await manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id, websocket)


@router.post("/internal/push", status_code=status.HTTP_204_NO_CONTENT)
async def internal_realtime_push(
    body: RealtimeInternalPush,
    x_internal_realtime_secret: str = Header(..., alias="X-Internal-Realtime-Secret"),
) -> None:
    """
    Called by the Procrastinate worker (separate process) to deliver events to
    sockets held in this API process.
    """
    if x_internal_realtime_secret != settings.INTERNAL_REALTIME_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid secret")

    await manager.send_personal_message(body.user_id, body.message)
