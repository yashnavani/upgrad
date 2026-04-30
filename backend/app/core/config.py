# backend/app/core/config.py
from pathlib import Path
from typing import Literal
from uuid import UUID

from pydantic import Field, PostgresDsn, computed_field, field_validator
from pydantic_core import MultiHostUrl
from pydantic_settings import BaseSettings, SettingsConfigDict

# Backend dir is 3 parents up from here; its parent is repo root in a normal clone.
# In Docker the app is only under `/app`, so "repo root" becomes `/` — skip loading `/.env`.
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


def _env_files_to_load() -> tuple[Path, ...] | None:
    repo_root = _BACKEND_DIR.parent
    candidates: list[Path] = []
    if repo_root != Path("/") and (p := repo_root / ".env").is_file():
        candidates.append(p)
    if (p := _BACKEND_DIR / ".env").is_file():
        candidates.append(p)
    return tuple(candidates) if candidates else None


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_files_to_load(),
        env_ignore_empty=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "Master Foundation"
    ENVIRONMENT: Literal["development", "staging", "production", "testing"] = "development"
    API_V1_STR: str = "/api/v1"

    @field_validator("ENVIRONMENT", mode="after")
    @classmethod
    def validate_production_settings(cls, v: str, info) -> str:
        if v == "production" and not info.data.get("SYSTEM_ACTOR_USER_ID"):
            raise ValueError(
                "SYSTEM_ACTOR_USER_ID must be set in production (single DB user for all requests)."
            )
        return v

    # Database Settings
    POSTGRES_SERVER: str
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str

    @field_validator("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", mode="before")
    @classmethod
    def strip_db_strings(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip().strip("\ufeff").replace("\r", "")
        return v

    # Async SQLAlchemy pool (each Gunicorn worker has its own pool)
    DB_POOL_SIZE: int = Field(default=5, ge=1, le=50)
    DB_MAX_OVERFLOW: int = Field(default=5, ge=0, le=50)
    DB_POOL_TIMEOUT: int = Field(default=30, ge=5, le=120)
    DB_POOL_RECYCLE: int = Field(
        default=1800,
        ge=60,
        description="Recycle connections after this many seconds (avoids stale sockets).",
    )

    @computed_field
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> PostgresDsn:
        """Constructs the async asyncpg connection URL dynamically."""
        return MultiHostUrl.build(
            scheme="postgresql+asyncpg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )

    # Single resolved User row for every authenticated endpoint (auth disabled).
    SYSTEM_ACTOR_USER_ID: UUID | None = Field(
        default=None,
        description="If set, this User.id is used as the actor for all API calls.",
    )

    # AI Configuration (empty until set; required for embeddings / agent features)
    GEMINI_API_KEY: str = Field(default="")

    # HeyGen LiveAvatar (optional; backend mints session token for the web SDK)
    LIVEAVATAR_API_KEY: str = Field(default="", description="LiveAvatar API key (X-API-KEY).")
    LIVEAVATAR_AVATAR_ID: str = Field(
        default="",
        description="Avatar UUID (HeyGen / LiveAvatar dashboard).",
    )
    LIVEAVATAR_USE_SANDBOX: bool = Field(default=True)
    LIVEAVATAR_SESSION_MODE: Literal["LITE", "FULL"] = Field(
        default="FULL",
        description=(
            "FULL sends avatar_persona (voice_id, language); needed for studio voice "
            "and speak_text over LiveKit."
        ),
    )
    LIVEAVATAR_LANGUAGE: str = Field(default="en")
    LIVEAVATAR_CONTEXT_ID: str = Field(
        default="",
        description="Optional context UUID for FULL mode avatar_persona.",
    )
    LIVEAVATAR_VOICE_ID: str = Field(
        default="",
        description="Optional voice UUID for FULL mode; empty uses avatar default.",
    )
    GEMINI_TEACHER_MODEL: str = Field(
        default="gemini-2.5-pro",
        description="Higher-reasoning model for nightly policy synthesis (Phase D).",
    )
    GEMINI_TTS_MODEL: str = Field(
        default="gemini-2.5-flash-preview-tts",
        description="Gemini native TTS model for voice-only mock interview playback.",
    )
    GEMINI_TTS_VOICE: str = Field(
        default="Kore",
        description="Prebuilt Gemini TTS voice name (see speech generation docs).",
    )

    # CORS: comma-separated browser origins (e.g. Next.js dev on localhost vs 127.0.0.1)
    BACKEND_CORS_ORIGINS: str = (
        "http://localhost:3001,"
        "http://127.0.0.1:3001,"
        "http://localhost:3000,"
        "http://127.0.0.1:3000"
    )

    def cors_origins_list(self) -> list[str]:
        return [
            o.strip()
            for o in self.BACKEND_CORS_ORIGINS.split(",")
            if o.strip()
        ]

    # Phase 16: worker process pushes to API so in-memory WebSockets receive events
    REALTIME_PUSH_BASE_URL: str = Field(
        default="http://127.0.0.1:8000",
        description="API base URL as seen by the worker (Compose: http://backend:8000).",
    )
    INTERNAL_REALTIME_SECRET: str = Field(
        default="dev-internal-realtime-secret-change-in-production",
        description="Shared secret for POST /realtime/internal/push from the worker.",
    )

    # Optional: distributed rate limiting (shared across Gunicorn workers / replicas)
    REDIS_URL: str | None = Field(
        default=None,
        description=(
            "If set (e.g. redis://redis:6379/0), rate limits use Redis; "
            "otherwise in-memory per process."
        ),
    )

    # Storage (Phase 12): local dev vs S3-compatible production
    STORAGE_BACKEND: Literal["local", "s3"] = "local"
    LOCAL_STORAGE_PATH: str = "data/uploads"

    S3_BUCKET_NAME: str | None = None
    S3_REGION: str | None = None
    S3_ACCESS_KEY: str | None = None
    S3_SECRET_KEY: str | None = None
    S3_ENDPOINT_URL: str | None = None

    @computed_field
    @property
    def local_storage_path_resolved(self) -> Path:
        """Absolute path for local uploads (relative paths are under `backend/`)."""
        p = Path(self.LOCAL_STORAGE_PATH)
        if p.is_absolute():
            return p.resolve()
        return (_BACKEND_DIR / p).resolve()


# Instantiate the settings so they can be imported across the app
settings = Settings()
