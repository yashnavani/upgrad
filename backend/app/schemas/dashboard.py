from pydantic import BaseModel, Field


class ChartDay(BaseModel):
    name: str = Field(..., description="Short weekday label")
    requests: int = Field(0, ge=0)
    ai_calls: int = Field(0, ge=0)


class DashboardMetrics(BaseModel):
    policies_active: int = 0
    policies_total: int = 0
    users_total: int | None = None
    pending_decisions: int | None = None
    audit_events_24h: int | None = None
    chart_days: list[ChartDay] = Field(default_factory=list)


class InsightItem(BaseModel):
    id: str
    title: str
    insight_type: str
    severity: str
    confidence: str
    timestamp: str
    description: str
