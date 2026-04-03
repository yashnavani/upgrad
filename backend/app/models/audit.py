# backend/app/models/audit.py
from sqlalchemy import JSON, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditLog(Base):
    """
    Universal Audit Log.
    Captures telemetry and access records for every action in the system.
    """

    # Who
    actor_id: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    client_ip: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)

    # What
    endpoint: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    http_method: Mapped[str] = mapped_column(String(10), index=True, nullable=False)

    # Result
    status_code: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    processing_time_ms: Mapped[float] = mapped_column(Float, nullable=False)

    # Optional Context (for specific business events like "Created Invoice")
    action_name: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    resource_id: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    extra_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    def __repr__(self) -> str:
        return f"<AuditLog {self.http_method} {self.endpoint} [{self.status_code}]>"
