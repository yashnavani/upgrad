# backend/app/api/v1/endpoints/policies.py
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.policy import Policy
from app.models.user import User
from app.schemas.policy import PolicyCreate, PolicyResponse, PolicyUpdate

router = APIRouter()


@router.post("", response_model=PolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_policy(
    policy_in: PolicyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Policy:
    """Create a new AI Policy / Business Rule."""
    data = policy_in.model_dump()
    tags = data.pop("tags") or None
    new_policy = Policy(
        **data,
        tags=tags,
        creator_id=current_user.id,
    )
    db.add(new_policy)
    await db.commit()
    await db.refresh(new_policy)
    return new_policy


@router.get("", response_model=list[PolicyResponse])
async def list_policies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Policy]:
    """Retrieve all policies that are not soft-deleted."""
    result = await db.execute(
        select(Policy)
        .where(Policy.is_deleted.is_(False))
        .order_by(Policy.priority.asc())
    )
    return list(result.scalars().all())


@router.get("/{policy_id}", response_model=PolicyResponse)
async def get_policy(
    policy_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Policy:
    """Get a specific policy by ID."""
    result = await db.execute(
        select(Policy).where(
            Policy.id == policy_id,
            Policy.is_deleted.is_(False),
        )
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


@router.patch("/{policy_id}", response_model=PolicyResponse)
async def update_policy(
    policy_id: UUID,
    policy_update: PolicyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Policy:
    """Update an existing policy (e.g., toggle active status)."""
    result = await db.execute(
        select(Policy).where(
            Policy.id == policy_id,
            Policy.is_deleted.is_(False),
        )
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    update_data = policy_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "tags":
            setattr(policy, field, value if value else None)
        else:
            setattr(policy, field, value)

    await db.commit()
    await db.refresh(policy)
    return policy


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_policy(
    policy_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Soft delete a policy."""
    result = await db.execute(
        select(Policy).where(
            Policy.id == policy_id,
            Policy.is_deleted.is_(False),
        )
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    policy.is_deleted = True
    policy.is_active = False
    await db.commit()
