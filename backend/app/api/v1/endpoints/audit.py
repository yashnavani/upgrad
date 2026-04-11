from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_superuser
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogRead

router = APIRouter()


@router.get("", response_model=list[AuditLogRead])
async def list_audit_logs(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_superuser),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[AuditLog]:
    """Paginated HTTP audit trail (telemetry middleware). Superuser only."""
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.is_deleted.is_(False))
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())
