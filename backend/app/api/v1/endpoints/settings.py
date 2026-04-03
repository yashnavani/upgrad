# backend/app/api/v1/endpoints/settings.py
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_superuser
from app.models.settings import SystemSetting
from app.models.user import User
from app.schemas.settings import SettingResponse, SettingUpdate

router = APIRouter()


@router.get("", response_model=list[SettingResponse])
async def list_settings(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_superuser),
) -> list[SystemSetting]:
    """Get all system settings. Admin only."""
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.is_deleted.is_(False))
    )
    return list(result.scalars().all())


@router.put("/{key}", response_model=SettingResponse)
async def upsert_setting(
    key: str,
    setting_in: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_superuser),
) -> SystemSetting:
    """Update or create a setting by its key."""
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()

    if setting:
        if setting.is_deleted:
            setting.is_deleted = False
        if setting_in.value is not None:
            setting.value = setting_in.value
        if setting_in.description is not None:
            setting.description = setting_in.description
        setting.updated_by_id = current_admin.id
    else:
        setting = SystemSetting(
            key=key,
            value=setting_in.value,
            description=setting_in.description,
            updated_by_id=current_admin.id,
        )
        db.add(setting)

    await db.commit()
    await db.refresh(setting)
    return setting
