# backend/app/schemas/interview.py
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.interview_constants import (
    INTERVIEW_MAX_TURNS_CAP,
    INTERVIEW_MIN_TURNS,
)


class ChatMessage(BaseModel):
    role: str
    content: str


class InterviewCreate(BaseModel):
    target_role: str = Field(..., max_length=255)
    focus_area: str = Field(..., description="behavioral, technical, case, mixed")
    resume_snippet: str | None = Field(None, max_length=50_000)
    max_turns: int | None = Field(
        None,
        ge=INTERVIEW_MIN_TURNS,
        le=INTERVIEW_MAX_TURNS_CAP,
        description="Candidate answer rounds before evaluation (default 6, range 5–10).",
    )


class ResumeParseOut(BaseModel):
    text: str
    truncated: bool = False
    filename: str | None = None


class InterviewTurn(BaseModel):
    answer: str = Field(..., min_length=1)


class InterviewResponse(BaseModel):
    id: UUID
    target_role: str
    focus_area: str
    resume_snippet: str | None
    status: str
    turn_count: int
    max_turns: int
    transcript: list[ChatMessage]
    feedback_data: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LiveAvatarTokenOut(BaseModel):
    session_token: str
    session_id: str


class LiveAvatarStatusOut(BaseModel):
    """Whether the server can mint HeyGen LiveAvatar tokens (both env vars set)."""

    available: bool


class VoiceTtsIn(BaseModel):
    """Text for Gemini native TTS (voice-only interview)."""

    text: str = Field(..., min_length=1, max_length=12_000)
