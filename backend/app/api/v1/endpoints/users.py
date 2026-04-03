# backend/app/api/v1/endpoints/users.py
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user, require_superuser
from app.models.user import User

router = APIRouter()


@router.get("/me", summary="Get Current User")
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Fetch the profile of the currently logged-in user.
    Any valid JWT will allow access to this endpoint.
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
