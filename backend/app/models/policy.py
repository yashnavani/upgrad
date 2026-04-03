# backend/app/models/policy.py
import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Policy(Base):
    """
    Stores business rules and AI instructions.
    Acts as the long-term memory and boundary limits for the Cognitive Router.
    """

    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The original human input
    natural_language: Mapped[str] = mapped_column(Text, nullable=False)

    # 'logical' (strict rules) or 'natural_language' (LLM interpreted)
    policy_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # The strict JSON structure (conditions and actions)
    dsl: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # The optimized prompt for the AI to read
    refined_instruction: Mapped[str | None] = mapped_column(Text, nullable=True)

    # If the rule applies to a specific vendor/customer
    entity_name: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)

    # Rule Evaluation Metadata
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    priority: Mapped[int] = mapped_column(
        Integer, default=100, index=True
    )  # Lower = executes first
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)  # JSON array

    # Telemetry
    execution_count: Mapped[int] = mapped_column(Integer, default=0)
    last_executed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Who created this rule
    creator_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("user.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Policy {self.name} [{self.policy_type}]>"
