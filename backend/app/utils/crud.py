# backend/app/utils/crud.py
"""
Generic async CRUD base class.

Subclass this in any endpoint module to get list / get / create / update / soft-delete
with zero boilerplate.  The Items blueprint uses it as the reference implementation.

Usage:
    from app.utils.crud import CRUDBase
    from app.models.lead import Lead
    from app.schemas.lead import LeadCreate, LeadUpdate

    class LeadCRUD(CRUDBase[Lead, LeadCreate, LeadUpdate]):
        pass

    leads = LeadCRUD(Lead)

    # In a route:
    item = await leads.get_or_404(db, id=lead_id)
    new  = await leads.create(db, obj_in=lead_data, extra={"owner_id": user.id})
    page = await leads.list_paginated(db, query=select(Lead).where(...), params=params)
"""
from typing import Any, Generic, TypeVar
from uuid import UUID

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

from app.models.base import Base
from app.utils.pagination import PaginatedResponse, PaginationParams, paginate

ModelT  = TypeVar("ModelT",  bound=Base)
CreateT = TypeVar("CreateT", bound=BaseModel)
UpdateT = TypeVar("UpdateT", bound=BaseModel)


class CRUDBase(Generic[ModelT, CreateT, UpdateT]):
    """Reusable async CRUD helper for SQLAlchemy async sessions."""

    def __init__(self, model: type[ModelT]) -> None:
        self.model = model

    # ── Read ──────────────────────────────────────────────────────────────────

    async def get(self, db: AsyncSession, *, id: UUID) -> ModelT | None:
        """Return the object by PK (excluding soft-deleted rows)."""
        result = await db.execute(
            select(self.model).where(
                self.model.id == id,
                self.model.is_deleted.is_(False),
            )
        )
        return result.scalar_one_or_none()

    async def get_or_404(self, db: AsyncSession, *, id: UUID, label: str | None = None) -> ModelT:
        """Like `get` but raises HTTP 404 when not found."""
        obj = await self.get(db, id=id)
        if obj is None:
            name = label or self.model.__name__
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{name} not found (id={id})",
            )
        return obj

    async def list(
        self,
        db: AsyncSession,
        *,
        query: Select | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ModelT]:
        """Return a flat list (no pagination envelope). Useful for small collections."""
        base_q = (
            query
            if query is not None
            else select(self.model).where(self.model.is_deleted.is_(False))
        )
        result = await db.execute(base_q.offset(skip).limit(limit))
        return list(result.scalars().all())

    async def list_paginated(
        self,
        db: AsyncSession,
        *,
        query: Select | None = None,
        params: PaginationParams,
        schema_cls: type | None = None,
    ) -> PaginatedResponse:
        """Return a PaginatedResponse envelope."""
        base_q = (
            query
            if query is not None
            else select(self.model).where(self.model.is_deleted.is_(False))
        )
        return await paginate(db, base_q, params, schema_cls)

    # ── Write ─────────────────────────────────────────────────────────────────

    async def create(
        self,
        db: AsyncSession,
        *,
        obj_in: CreateT,
        extra: dict[str, Any] | None = None,
    ) -> ModelT:
        """Create and return a new persisted object."""
        data = obj_in.model_dump()
        if extra:
            data.update(extra)
        obj = self.model(**data)
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return obj

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelT,
        obj_in: UpdateT | dict[str, Any],
    ) -> ModelT:
        """Apply partial updates to an existing object."""
        update_data = (
            obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)
        )

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def soft_delete(self, db: AsyncSession, *, db_obj: ModelT) -> ModelT:
        """Mark the object as deleted without removing it from the database."""
        db_obj.is_deleted = True  # type: ignore[attr-defined]
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def hard_delete(self, db: AsyncSession, *, db_obj: ModelT) -> None:
        """Permanently remove the row. Use only when data-retention rules allow it."""
        await db.delete(db_obj)
        await db.commit()
