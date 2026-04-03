# backend/app/services/realtime.py
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    In-memory map of user id -> active WebSocket connections.
    The API process owns this; background workers reach it via HTTP internal push.
    """

    def __init__(self) -> None:
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(
            "User %s connected to realtime bus (%s users online).",
            user_id,
            len(self.active_connections),
        )

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        if user_id not in self.active_connections:
            return
        try:
            self.active_connections[user_id].remove(websocket)
        except ValueError:
            return
        if not self.active_connections[user_id]:
            del self.active_connections[user_id]
        logger.info("User %s disconnected from realtime bus.", user_id)

    async def send_personal_message(self, user_id: str, message: dict[str, Any]) -> None:
        """Send a JSON payload to every open socket for that user."""
        sockets = self.active_connections.get(user_id)
        if not sockets:
            return
        dead: list[WebSocket] = []
        for connection in list(sockets):
            try:
                await connection.send_json(message)
            except Exception:
                logger.exception("Failed to send websocket message; dropping socket.")
                dead.append(connection)
        for ws in dead:
            self.disconnect(user_id, ws)


manager = ConnectionManager()
