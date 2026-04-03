# backend/app/api/v1/endpoints/files.py
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.storage import get_storage
from app.models.file_asset import FileAsset
from app.models.user import User

router = APIRouter()


@router.post("/upload", summary="Upload a file (authenticated)")
async def upload_file(
    file: UploadFile = File(...),
    directory: Annotated[str, Query(description="Logical folder under uploads root")] = "uploads",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    storage = get_storage()
    try:
        storage_path, size_bytes = await storage.save_file(file, directory=directory)
    except NotImplementedError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(e),
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File save failed: {e}",
        ) from e

    record = FileAsset(
        original_filename=file.filename or "unknown",
        storage_path=storage_path,
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=size_bytes,
        owner_id=current_user.id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return {
        "message": "File uploaded successfully",
        "file_id": str(record.id),
        "path": storage_path,
        "size_bytes": size_bytes,
    }


def _resolved_local_file(storage_path: str) -> Path:
    base = settings.local_storage_path_resolved.resolve()
    full = (base / storage_path).resolve()
    base_s = str(base)
    full_s = str(full)
    if not full_s.startswith(base_s):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid storage path",
        )
    return full


@router.get("/{file_id}", summary="Download a file by id")
async def download_file(
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(FileAsset).where(FileAsset.id == file_id))
    file_record = result.scalar_one_or_none()

    if not file_record or file_record.is_deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    if file_record.owner_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this file",
        )

    if settings.STORAGE_BACKEND == "local":
        full_path = _resolved_local_file(file_record.storage_path)
        if not full_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File missing from storage",
            )
        return FileResponse(
            path=str(full_path),
            media_type=file_record.mime_type,
            filename=file_record.original_filename,
        )

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="S3 download is not implemented yet.",
    )
