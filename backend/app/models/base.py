# backend/app/models/base.py
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, declared_attr


class Base(DeclarativeBase):
    """
    Universal Base Model.
    Automatically names tables and adds id, created_at, updated_at, and is_deleted.
    """

    __abstract__ = True

    # Automatically generate table names based on the class name (e.g., User -> user)
    @declared_attr.directive
    def __tablename__(cls) -> str:
        return cls.__name__.lower()

    # We use UUIDv4 for absolute uniqueness across distributed systems
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # Timezone-aware datetimes are mandatory for global applications
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Soft deletes: Never permanently delete data
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
