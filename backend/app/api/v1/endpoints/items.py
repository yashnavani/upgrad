# backend/app/api/v1/endpoints/items.py
"""
CRUD Blueprint — use this as the reference pattern when building new business entities.

Demonstrates:
  • Typed HTTP exceptions (app.core.exceptions)
  • Generic CRUD helper  (app.utils.crud)
  • Offset pagination    (app.utils.pagination)
  • Ownership guard + superuser bypass
  • Soft-delete (DELETE) with a hard-delete escape hatch for superusers
"""
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_superuser
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.item import Item
from app.models.user import User
from app.schemas.item import ItemCreate, ItemResponse, ItemUpdate
from app.utils.crud import CRUDBase
from app.utils.pagination import PaginatedResponse, PaginationParams

router = APIRouter()

# Instantiate the generic CRUD helper for this model
_crud = CRUDBase[Item, ItemCreate, ItemUpdate](Item)


# ── Create ────────────────────────────────────────────────────────────────────


@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    item_in: ItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Item:
    """Create a new item owned by the authenticated user."""
    return await _crud.create(db, obj_in=item_in, extra={"owner_id": current_user.id})


# ── List (paginated) ──────────────────────────────────────────────────────────


@router.get("", response_model=PaginatedResponse[ItemResponse])
async def list_items(
    params: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse:
    """List items owned by the current user with offset pagination."""
    query = select(Item).where(
        Item.owner_id == current_user.id,
        Item.is_deleted.is_(False),
    )
    return await _crud.list_paginated(db, query=query, params=params, schema_cls=ItemResponse)


# ── Get single ────────────────────────────────────────────────────────────────


@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Item:
    """Fetch a single item by ID (must be owner or superuser)."""
    item = await _crud.get_or_404(db, id=item_id, label="Item")
    if item.owner_id != current_user.id and not current_user.is_superuser:
        raise ForbiddenError("You do not own this item.")
    return item


# ── Update ────────────────────────────────────────────────────────────────────


@router.patch("/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: UUID,
    item_in: ItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Item:
    """Partially update an item (must be owner or superuser)."""
    item = await _crud.get_or_404(db, id=item_id, label="Item")
    if item.owner_id != current_user.id and not current_user.is_superuser:
        raise ForbiddenError("You do not have permission to edit this item.")
    return await _crud.update(db, db_obj=item, obj_in=item_in)


# ── Delete (soft) ─────────────────────────────────────────────────────────────


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Soft-delete an item (sets is_deleted=True, data is preserved).
    Only the owner or a superuser may delete.
    """
    item = await _crud.get_or_404(db, id=item_id, label="Item")
    if item.owner_id != current_user.id and not current_user.is_superuser:
        raise ForbiddenError("You do not have permission to delete this item.")
    await _crud.soft_delete(db, db_obj=item)


# ── Hard-delete (superuser only) ──────────────────────────────────────────────


@router.delete("/{item_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
async def hard_delete_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_superuser),
) -> None:
    """
    Permanently remove an item from the database.
    Superuser-only. Use only when data-retention rules allow it.
    """
    result = await db.execute(select(Item).where(Item.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundError("Item", str(item_id))
    await _crud.hard_delete(db, db_obj=item)
