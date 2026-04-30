# backend/tests/test_dashboard.py
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.item import Item
from app.models.user import User

METRICS = "/api/v1/dashboard/metrics"


@pytest.mark.asyncio
async def test_metrics_regular_user_scoped_shape(auth_client: AsyncClient):
    r = await auth_client.get(METRICS)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["users_total"] is None
    assert body["items_owned"] is not None
    assert isinstance(body["items_owned"], int)
    assert body["audit_events_24h"] is not None
    assert len(body["chart_days"]) == 7


@pytest.mark.asyncio
async def test_metrics_superuser_org_shape(superuser_client: AsyncClient):
    r = await superuser_client.get(METRICS)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["users_total"] is not None
    assert body["items_owned"] is None
    assert len(body["chart_days"]) == 7


@pytest.mark.asyncio
async def test_metrics_personal_audit_and_items(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
):
    db_session.add(
        AuditLog(
            actor_id=str(test_user.id),
            client_ip="127.0.0.1",
            user_agent="pytest",
            endpoint="/api/v1/ping",
            http_method="GET",
            status_code=200,
            processing_time_ms=2.5,
        )
    )
    db_session.add(
        Item(
            title="Dash item",
            description=None,
            owner_id=test_user.id,
            status="pending",
        )
    )
    await db_session.commit()

    r = await auth_client.get(METRICS)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["audit_events_24h"] >= 1
    assert body["items_owned"] >= 1
