# backend/app/schemas/realtime.py
from typing import Any

from pydantic import BaseModel, Field


class RealtimeInternalPush(BaseModel):
    user_id: str = Field(..., description="Target user UUID as string (JWT sub)")
    message: dict[str, Any]
