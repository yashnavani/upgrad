# backend/app/api/v1/endpoints/users.py
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_superuser
from app.models.user import User
from app.schemas.user_admin import UserListItem

router = APIRouter()


@router.get("", response_model=list[UserListItem], summary="List users (admin)")
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_superuser),
) -> list[User]:
    result = await db.execute(
        select(User).where(User.is_deleted.is_(False)).order_by(User.email.asc())
    )
    return list(result.scalars().all())


@router.get("/me", summary="Get Current User")
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Profile for the resolved system actor (see SYSTEM_ACTOR_USER_ID / first active user).
    """
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_superuser": current_user.is_superuser,
    }


@router.get("/admin-only", summary="Admin Dashboard Data")
async def read_admin_data(current_user: User = Depends(require_superuser)):
    """
    Highly secure endpoint.
    Only users with is_superuser=True in the database can access this.
    """
    return {
        "message": "Welcome to the command center, Admin.",
        "secret_data": "Top secret metrics go here.",
    }
