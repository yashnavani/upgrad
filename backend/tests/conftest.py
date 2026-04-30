"""
Pytest fixtures shared across the test suite.

asyncio_mode = auto  is set in pytest.ini — no need for an event_loop fixture.
"""
import os

# Imports after env: Settings + engine must use *_test DB (see pyproject per-file-ignores).
os.environ["ENVIRONMENT"] = "testing"
_pg_db = os.environ.get("POSTGRES_DB", "master_foundation")
if not str(_pg_db).endswith("_test"):
    os.environ["POSTGRES_DB"] = f"{str(_pg_db).removesuffix('_test')}_test"

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401 — register all ORM tables on Base.metadata for create_all
from app.api.deps import get_current_user, get_db
from app.core.auth_service import get_password_hash
from app.core.config import settings
from app.main import app
from app.models.base import Base
from app.models.user import User

# Same URL as app.core.database engine (POSTGRES_DB is …_test above).
test_engine = create_async_engine(str(settings.SQLALCHEMY_DATABASE_URI), echo=False)
TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


@pytest_asyncio.fixture(scope="session", autouse=True, loop_scope="session")
async def setup_test_database_and_overrides() -> AsyncGenerator[None, None]:
    """Create schema on the test DB and route HTTP deps.get_db to that engine."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Per-test session for seeding data (same DB as HTTP routes via override)."""
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """HTTP client with no get_current_user override (uses first DB user or 503)."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a regular (non-superuser) test user."""
    user = User(
        email="test_user@example.com",
        full_name="Test User",
        hashed_password=get_password_hash("testpassword123"),
        is_active=True,
        is_superuser=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_superuser(db_session: AsyncSession) -> User:
    """Create a superuser for privileged-endpoint tests."""
    user = User(
        email="test_admin@example.com",
        full_name="Test Admin",
        hashed_password=get_password_hash("adminpassword123"),
        is_active=True,
        is_superuser=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def auth_client(test_user: User) -> AsyncGenerator[AsyncClient, None]:
    """Client acting as regular test_user."""

    async def _as_test_user() -> User:
        return test_user

    app.dependency_overrides[get_current_user] = _as_test_user
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
async def superuser_client(test_superuser: User) -> AsyncGenerator[AsyncClient, None]:
    """Client acting as test_superuser."""

    async def _as_super() -> User:
        return test_superuser

    app.dependency_overrides[get_current_user] = _as_super
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_current_user, None)
