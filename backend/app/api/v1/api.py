# backend/app/api/v1/api.py
from fastapi import APIRouter

from app.api.v1.endpoints import (
    ai,
    audit,
    auth,
    dashboard,
    decisions,
    feedback,
    files,
    health,
    items,
    metrics,
    policies,
    realtime,
    reports,
    settings,
    users,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["System"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(audit.router, prefix="/audit-logs", tags=["Audit"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(ai.router, prefix="/ai", tags=["Cognitive Router"])
api_router.include_router(
    feedback.router, prefix="/feedback", tags=["AI Feedback"]
)
api_router.include_router(
    decisions.router, prefix="/decisions", tags=["HITL Decisions"]
)
api_router.include_router(files.router, prefix="/files", tags=["Storage"])
api_router.include_router(policies.router, prefix="/policies", tags=["Policies"])
api_router.include_router(
    settings.router, prefix="/settings", tags=["System Settings"]
)
api_router.include_router(items.router, prefix="/items", tags=["CRUD Blueprint"])
api_router.include_router(
    reports.router, prefix="/reports", tags=["Background Tasks"]
)
api_router.include_router(
    realtime.router, prefix="/realtime", tags=["Real-Time Bus"]
)
api_router.include_router(metrics.router, tags=["Monitoring"])
