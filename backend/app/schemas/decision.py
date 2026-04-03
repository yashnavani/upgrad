# backend/app/schemas/decision.py
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DecisionRead(BaseModel):
    id: UUID
    action_type: str
    input_context: dict[str, Any]
    reasoning: str
    confidence_score: float
    status: str
    feedback_notes: str | None
    approver_id: UUID | None
    proposed_payload: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RejectDecisionBody(BaseModel):
    reason: str = Field(..., min_length=1, max_length=8000)
