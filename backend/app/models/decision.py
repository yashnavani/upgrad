# backend/app/models/decision.py
import uuid
from typing import Any

from pgvector.sqlalchemy import VECTOR
from sqlalchemy import JSON, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

EMBEDDING_DIM = 768


class AgenticDecision(Base):
    """
    Decision journal: proposals that require human approval before execution.
    """

    action_type: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    input_context: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    reasoning: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)

    status: Mapped[str] = mapped_column(
        String(50), default="pending", index=True, nullable=False
    )

    feedback_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    approver_id: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user.id", ondelete="SET NULL"),
        nullable=True,
    )

    proposed_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    # Semantic recall (Gemini text-embedding-004, 768 dims). Loaded via raw SQL / deferred in ORM.
    embedding: Mapped[list[float] | None] = mapped_column(
        VECTOR(EMBEDDING_DIM),
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<Decision {self.action_type} [{self.status}]>"
