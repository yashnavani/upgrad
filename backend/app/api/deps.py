# backend/app/api/deps.py
from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.user import User


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yields an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def _resolve_system_actor(db: AsyncSession) -> User | None:
    if settings.SYSTEM_ACTOR_USER_ID is not None:
        result = await db.execute(
            select(User).where(
                User.id == settings.SYSTEM_ACTOR_USER_ID,
                User.is_deleted.is_(False),
            )
        )
        return result.scalar_one_or_none()

    result = await db.execute(
        select(User)
        .where(User.is_active.is_(True), User.is_deleted.is_(False))
        .order_by(User.created_at.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Single DB actor for all requests (JWT / login removed)."""
    user = await _resolve_system_actor(db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "No system actor user: create a User (e.g. create_admin.py) "
                "or set SYSTEM_ACTOR_USER_ID to a valid user UUID."
            ),
        )
    if not user.is_active or user.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System actor user is inactive or deleted.",
        )

    request.state.user = user
    return user


async def require_superuser(current_user: User = Depends(get_current_user)) -> User:
    """RBAC: requires is_superuser=True on the system actor row."""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have enough privileges to access this resource.",
        )
    return current_user


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Returns system actor when present; no 503 (for optional-auth style endpoints)."""
    user = await _resolve_system_actor(db)
    if user and user.is_active and not user.is_deleted:
        request.state.user = user
        return user
    return None
