# backend/app/core/auth_service.py
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

ALGORITHM = "HS256"


def create_access_token(
    subject: str,
    *,
    email: str | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Issue HS256 JWT with aud=authenticated (same contract as prior Supabase tokens)."""
    if expires_delta is not None:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    to_encode: dict[str, Any] = {
        "exp": expire,
        "sub": subject,
        "aud": "authenticated",
    }
    if email:
        to_encode["email"] = email
    encoded = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=ALGORITHM)
    return encoded if isinstance(encoded, str) else encoded.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)
