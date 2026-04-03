# backend/app/core/security.py
import logging
from typing import Any

import jwt
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)


def verify_jwt_token(token: str) -> dict[str, Any]:
    """Verify HS256 JWT issued by native auth_service (audience authenticated)."""
    try:
        decoded_token = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return decoded_token
    except jwt.ExpiredSignatureError:
        logger.warning("Token verification failed: Token has expired.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except jwt.InvalidTokenError as e:
        logger.warning("Token verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None


def decode_access_token_for_websocket(token: str) -> dict[str, Any] | None:
    """
    Validate JWT for WebSocket upgrade (no HTTPException — caller closes the socket).
    """
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError:
        logger.debug("WebSocket JWT rejected.", exc_info=True)
        return None
