# backend/app/models/interview.py
import uuid
from typing import Any

from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class InterviewSession(Base):
    """Mock interview session: transcript, turn state, evaluator + coach output."""

    target_role: Mapped[str] = mapped_column(String(255), nullable=False)
    focus_area: Mapped[str] = mapped_column(String(100), nullable=False)
    resume_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(
        String(50), default="in_progress", index=True, nullable=False
    )
    turn_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_turns: Mapped[int] = mapped_column(Integer, default=6, nullable=False)

    transcript: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    feedback_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<InterviewSession {self.target_role!r} [{self.status}]>"
