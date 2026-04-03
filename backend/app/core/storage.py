# backend/app/core/storage.py
"""
Storage adapter (Strategy): routes persist to local disk today; swap implementation
via STORAGE_BACKEND (e.g. S3 in ap-south-1) without changing API routes.
"""
from __future__ import annotations

import os
import re
import uuid
from pathlib import Path
from typing import Protocol

import aiofiles
from fastapi import UploadFile

from app.core.config import settings

_SAFE_DIR = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$")


def _sanitize_directory(directory: str) -> str:
    d = directory.strip().strip("/").replace("..", "")
    if not d or not _SAFE_DIR.match(d):
        return "general"
    return d


class StorageBackend(Protocol):
    async def save_file(
        self, file: UploadFile, directory: str = "general"
    ) -> tuple[str, int]: ...

    async def delete_file(self, storage_path: str) -> bool: ...


class LocalStorageBackend:
    """Async writes to local disk under a configured root (dev default: backend/data/uploads)."""

    def __init__(self, base_path: str | Path) -> None:
        self.base_path = Path(base_path).resolve()
        self.base_path.mkdir(parents=True, exist_ok=True)

    async def save_file(
        self, file: UploadFile, directory: str = "general"
    ) -> tuple[str, int]:
        subdir = _sanitize_directory(directory)
        ext = os.path.splitext(file.filename or "")[1][:32]
        secure_name = f"{uuid.uuid4().hex}{ext}"

        target_dir = (self.base_path / subdir).resolve()
        if not str(target_dir).startswith(str(self.base_path)):
            raise ValueError("Invalid storage path")
        target_dir.mkdir(parents=True, exist_ok=True)

        file_path = target_dir / secure_name
        written = 0
        async with aiofiles.open(file_path, "wb") as out_file:
            while chunk := await file.read(1024 * 1024):
                await out_file.write(chunk)
                written += len(chunk)

        rel = f"{subdir}/{secure_name}"
        return rel, written

    async def delete_file(self, storage_path: str) -> bool:
        full = (self.base_path / storage_path).resolve()
        if not str(full).startswith(str(self.base_path)):
            return False
        if full.is_file():
            await _remove_file_async(full)
            return True
        return False


async def _remove_file_async(path: Path) -> None:
    """Avoid blocking the loop on unlink."""
    import asyncio

    await asyncio.to_thread(path.unlink, missing_ok=True)


_backend: StorageBackend | None = None


def get_storage() -> StorageBackend:
    global _backend
    if settings.STORAGE_BACKEND == "s3":
        raise NotImplementedError(
            "S3 storage backend is not implemented yet; set STORAGE_BACKEND=local."
        )
    if _backend is None:
        _backend = LocalStorageBackend(settings.local_storage_path_resolved)
    return _backend
