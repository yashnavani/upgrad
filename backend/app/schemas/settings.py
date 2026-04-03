# backend/app/schemas/settings.py
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SettingBase(BaseModel):
    key: str = Field(..., max_length=255)
    value: str | None = None
    description: str | None = None


class SettingCreate(SettingBase):
    pass


class SettingUpdate(BaseModel):
    value: str | None = None
    description: str | None = None


class SettingResponse(SettingBase):
    id: UUID
    updated_by_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
