# backend/app/schemas/policy.py
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

PolicyTypeLiteral = Literal["logical", "natural_language"]


class PolicyBase(BaseModel):
    name: str = Field(..., max_length=255)
    description: str | None = None
    natural_language: str
    policy_type: PolicyTypeLiteral = Field(
        ..., description="'logical' or 'natural_language'"
    )
    dsl: dict[str, Any] | None = None
    refined_instruction: str | None = None
    entity_name: str | None = None
    is_active: bool = True
    priority: int = 100
    tags: list[str] = Field(default_factory=list)


class PolicyCreate(PolicyBase):
    pass


class PolicyUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    natural_language: str | None = None
    policy_type: PolicyTypeLiteral | None = None
    dsl: dict[str, Any] | None = None
    refined_instruction: str | None = None
    entity_name: str | None = None
    is_active: bool | None = None
    priority: int | None = None
    tags: list[str] | None = None


class PolicyResponse(PolicyBase):
    id: UUID
    execution_count: int
    last_executed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    creator_id: UUID

    model_config = ConfigDict(from_attributes=True)

    @field_validator("tags", mode="before")
    @classmethod
    def tags_none_as_list(cls, v: object) -> list[str]:
        if v is None:
            return []
        if isinstance(v, list):
            return v
        return []
