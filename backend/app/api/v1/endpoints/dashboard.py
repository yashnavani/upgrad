from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import case, cast, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.audit import AuditLog
from app.models.decision import AgenticDecision
from app.models.item import Item
from app.models.policy import Policy
from app.models.user import User
from app.schemas.dashboard import ChartDay, DashboardMetrics, InsightItem

router = APIRouter()


def _weekday_labels() -> list[datetime]:
    today = datetime.now(UTC).date()
    return [
        datetime.combine(today - timedelta(days=i), datetime.min.time(), tzinfo=UTC)
        for i in range(6, -1, -1)
    ]


def _rows_to_chart_days(rows: list) -> list[ChartDay]:
    by_day: dict[str, tuple[int, int]] = {}
    for m in rows:
        d = m["day"]
        if d is None:
            continue
        key = d.date().isoformat() if hasattr(d, "date") else str(d)[:10]
        by_day[key] = (int(m["requests"] or 0), int(m["ai_calls"] or 0))

    chart: list[ChartDay] = []
    for dt in _weekday_labels():
        key = dt.date().isoformat()
        r, a = by_day.get(key, (0, 0))
        chart.append(
            ChartDay(
                name=dt.strftime("%a"),
                requests=r,
                ai_calls=a,
            )
        )
    return chart


async def _audit_chart_rows(
    db: AsyncSession, *, since_7d: datetime, actor_id: str | None
) -> list:
    day_trunc = func.date_trunc("day", AuditLog.created_at).label("day")
    stmt = (
        select(
            day_trunc,
            func.count().label("requests"),
            func.sum(
                case((AuditLog.endpoint.like("%/ai/chat%"), 1), else_=0)
            ).label("ai_calls"),
        )
        .where(AuditLog.is_deleted.is_(False), AuditLog.created_at >= since_7d)
    )
    if actor_id is not None:
        stmt = stmt.where(AuditLog.actor_id == actor_id)
    result = await db.execute(stmt.group_by(day_trunc).order_by(day_trunc))
    return result.mappings().all()


@router.get("/metrics", response_model=DashboardMetrics)
async def dashboard_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardMetrics:
    """Aggregates for overview + chart.

    Superusers see org-wide totals; others see scoped metrics.
    """
    pa = await db.scalar(
        select(func.count())
        .select_from(Policy)
        .where(Policy.is_deleted.is_(False), Policy.is_active.is_(True))
    )
    pt = await db.scalar(
        select(func.count()).select_from(Policy).where(Policy.is_deleted.is_(False))
    )

    since_24h = datetime.now(UTC) - timedelta(hours=24)
    since_7d = datetime.now(UTC) - timedelta(days=7)

    if not current_user.is_superuser:
        aid = str(current_user.id)
        ae = await db.scalar(
            select(func.count())
            .select_from(AuditLog)
            .where(
                AuditLog.is_deleted.is_(False),
                AuditLog.created_at >= since_24h,
                AuditLog.actor_id == aid,
            )
        )
        rows = await _audit_chart_rows(db, since_7d=since_7d, actor_id=aid)
        pd = await db.scalar(
            select(func.count())
            .select_from(AgenticDecision)
            .where(
                AgenticDecision.status == "pending",
                AgenticDecision.is_deleted.is_(False),
                cast(AgenticDecision.input_context, JSONB).contains({"requested_by_user_id": aid}),
            )
        )
        io = await db.scalar(
            select(func.count())
            .select_from(Item)
            .where(Item.is_deleted.is_(False), Item.owner_id == current_user.id)
        )
        return DashboardMetrics(
            policies_active=int(pa or 0),
            policies_total=int(pt or 0),
            users_total=None,
            pending_decisions=int(pd or 0),
            audit_events_24h=int(ae or 0),
            chart_days=_rows_to_chart_days(rows),
            items_owned=int(io or 0),
        )

    ut = await db.scalar(
        select(func.count()).select_from(User).where(User.is_deleted.is_(False))
    )
    pd = await db.scalar(
        select(func.count())
        .select_from(AgenticDecision)
        .where(
            AgenticDecision.status == "pending",
            AgenticDecision.is_deleted.is_(False),
        )
    )
    ae = await db.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(AuditLog.is_deleted.is_(False), AuditLog.created_at >= since_24h)
    )

    rows = await _audit_chart_rows(db, since_7d=since_7d, actor_id=None)
    chart = _rows_to_chart_days(rows)

    return DashboardMetrics(
        policies_active=int(pa or 0),
        policies_total=int(pt or 0),
        users_total=int(ut or 0),
        pending_decisions=int(pd or 0),
        audit_events_24h=int(ae or 0),
        chart_days=chart,
        items_owned=None,
    )


@router.get("/insights", response_model=list[InsightItem])
async def dashboard_insights(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InsightItem]:
    """Rule-based operational insights (full list for superusers only)."""
    if not current_user.is_superuser:
        return []

    now = datetime.now(UTC)
    since_24h = now - timedelta(hours=24)
    insights: list[InsightItem] = []

    pending = await db.scalar(
        select(func.count())
        .select_from(AgenticDecision)
        .where(
            AgenticDecision.status == "pending",
            AgenticDecision.is_deleted.is_(False),
        )
    )
    if int(pending or 0) > 0:
        insights.append(
            InsightItem(
                id="pending-approvals",
                title=f"{pending} human approval(s) waiting",
                insight_type="Operations",
                severity="WARNING",
                confidence="100%",
                timestamp=now.isoformat(),
                description=(
                    "Agent proposals are queued until a superuser approves or rejects them "
                    "in Agent Insights → Decisions."
                ),
            )
        )

    total_24h = await db.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(AuditLog.is_deleted.is_(False), AuditLog.created_at >= since_24h)
    )
    err_24h = await db.scalar(
        select(func.count())
        .select_from(AuditLog)
        .where(
            AuditLog.is_deleted.is_(False),
            AuditLog.created_at >= since_24h,
            AuditLog.status_code >= 500,
        )
    )
    t24 = int(total_24h or 0)
    e24 = int(err_24h or 0)
    if t24 >= 20 and e24 / t24 > 0.05:
        insights.append(
            InsightItem(
                id="error-rate",
                title="Elevated 5xx rate on API traffic",
                insight_type="Reliability",
                severity="CRITICAL",
                confidence="90%",
                timestamp=now.isoformat(),
                description=(
                    f"In the last 24 hours, {e24} of {t24} audited requests returned HTTP 5xx. "
                    "Review run logs and upstream dependencies."
                ),
            )
        )

    avg_ai_ms = await db.scalar(
        select(func.avg(AuditLog.processing_time_ms))
        .where(
            AuditLog.is_deleted.is_(False),
            AuditLog.created_at >= since_24h,
            AuditLog.endpoint.like("%/ai/chat%"),
        )
    )
    if avg_ai_ms is not None and float(avg_ai_ms) > 8000:
        insights.append(
            InsightItem(
                id="ai-latency",
                title="High average latency on /ai/chat",
                insight_type="Performance",
                severity="WARNING",
                confidence="85%",
                timestamp=now.isoformat(),
                description=(
                    f"Mean processing time for AI chat requests in the last 24h is "
                    f"{float(avg_ai_ms):.0f} ms. Consider model routing, timeouts, or backend load."
                ),
            )
        )

    active_policies = await db.scalar(
        select(func.count())
        .select_from(Policy)
        .where(Policy.is_deleted.is_(False), Policy.is_active.is_(True))
    )
    if int(active_policies or 0) == 0:
        insights.append(
            InsightItem(
                id="no-policies",
                title="No active agent policies",
                insight_type="Governance",
                severity="WARNING",
                confidence="100%",
                timestamp=now.isoformat(),
                description=(
                    "There are zero active policies. Define guardrails under Policies & tools "
                    "before exposing agents to clients."
                ),
            )
        )

    return insights
