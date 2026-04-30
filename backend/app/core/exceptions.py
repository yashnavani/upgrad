# backend/app/core/exceptions.py
"""
Typed HTTP exception helpers.

Usage:
    from app.core.exceptions import NotFoundError, ForbiddenError

    raise NotFoundError("Policy", str(policy_id))
    raise ForbiddenError("Superuser access required.")
    raise ConflictError("A user with this email already exists.")
"""
from fastapi import HTTPException, status


class NotFoundError(HTTPException):
    """404 — resource does not exist or has been soft-deleted."""

    def __init__(self, resource: str = "Resource", identifier: str | None = None) -> None:
        detail = f"{resource} not found"
        if identifier:
            detail += f" (id={identifier})"
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class ForbiddenError(HTTPException):
    """403 — authenticated but not authorised."""

    def __init__(self, detail: str = "You do not have permission to perform this action.") -> None:
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class UnauthorizedError(HTTPException):
    """401 — no valid credentials supplied."""

    def __init__(self, detail: str = "Authentication required.") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ConflictError(HTTPException):
    """409 — the resource already exists or violates a uniqueness constraint."""

    def __init__(self, detail: str = "Resource already exists.") -> None:
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class UnprocessableError(HTTPException):
    """422 — the request is syntactically valid but semantically wrong."""

    def __init__(self, detail: str) -> None:
        super().__init__(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail)


class ServiceUnavailableError(HTTPException):
    """503 — a downstream dependency is unavailable."""

    def __init__(
        self,
        detail: str = "Service temporarily unavailable. Please retry later.",
    ) -> None:
        super().__init__(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)


class BadRequestError(HTTPException):
    """400 — the request is malformed or contains invalid data."""

    def __init__(self, detail: str = "Bad request.") -> None:
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class TooManyRequestsError(HTTPException):
    """429 — caller has exceeded the rate limit."""

    def __init__(self, detail: str = "Too many requests. Please slow down.") -> None:
        super().__init__(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=detail)
