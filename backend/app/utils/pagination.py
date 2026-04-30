# backend/app/utils/pagination.py
"""
Standardised offset-based pagination utilities.

Usage in a route:
    from app.utils.pagination import PaginationParams, paginate, PaginatedResponse

    @router.get("", response_model=PaginatedResponse[MySchema])
    async def list_things(
        params: PaginationParams = Depends(),
        db: AsyncSession = Depends(get_db),
    ):
        query = select(MyModel).where(MyModel.is_deleted.is_(False))
        return await paginate(db, query, params, MySchema)
"""
from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select

T = TypeVar("T")

# ── Query-param dependency ────────────────────────────────────────────────────


class PaginationParams:
    """FastAPI dependency for ?page=1&page_size=20 query params."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1, description="1-based page number"),
        page_size: int = Query(default=20, ge=1, le=200, description="Items per page"),
    ) -> None:
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


# ── Response envelope ─────────────────────────────────────────────────────────


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response envelope returned to callers."""

    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int
    has_next: bool
    has_prev: bool

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def build(cls, items: list[T], total: int, params: PaginationParams) -> "PaginatedResponse[T]":
        pages = max(1, -(-total // params.page_size))  # ceiling division
        return cls(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            pages=pages,
            has_next=params.page < pages,
            has_prev=params.page > 1,
        )


# ── Helper: run paginated query against DB ─────────────────────────────────────


async def paginate(
    db: AsyncSession,
    query: Select,
    params: PaginationParams,
    schema_cls: type[T] | None = None,
) -> PaginatedResponse:
    """
    Execute `query` with count + slice, return a PaginatedResponse.

    If `schema_cls` is provided, each ORM row is converted via
    `schema_cls.model_validate(row)`. Otherwise raw ORM objects are returned.
    """
    # Total count (strip ORDER BY to avoid errors)
    count_query = select(func.count()).select_from(query.order_by(None).subquery())
    total_result = await db.execute(count_query)
    total: int = total_result.scalar_one()

    # Sliced data
    paged_query = query.offset(params.offset).limit(params.limit)
    rows_result = await db.execute(paged_query)
    rows = list(rows_result.scalars().all())

    items = (
        [schema_cls.model_validate(row) for row in rows]
        if schema_cls is not None
        else rows
    )

    return PaginatedResponse.build(items=items, total=total, params=params)
