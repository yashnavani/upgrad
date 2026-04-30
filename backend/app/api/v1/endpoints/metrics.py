"""
System metrics and monitoring endpoints.
"""
import sys
from datetime import datetime

import psutil
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_superuser
from app.core.database import get_db_pool_status
from app.core.logging_config import get_logger

router = APIRouter()
logger = get_logger(__name__)


class SystemMetrics(BaseModel):
    timestamp: datetime
    cpu_percent: float
    memory_percent: float
    memory_available_mb: float
    disk_usage_percent: float
    python_version: str
    uptime_seconds: float


class DatabaseMetrics(BaseModel):
    pool_size: int
    checked_in: int
    checked_out: int
    overflow: int
    total_connections: int


class MetricsResponse(BaseModel):
    system: SystemMetrics
    database: DatabaseMetrics


_start_time = datetime.now()


@router.get(
    "/metrics",
    response_model=MetricsResponse,
    dependencies=[Depends(require_superuser)],
    tags=["Monitoring"],
)
async def get_metrics():
    """
    Get system and database metrics.
    Requires superuser authentication.
    """
    uptime = (datetime.now() - _start_time).total_seconds()

    system_metrics = SystemMetrics(
        timestamp=datetime.now(),
        cpu_percent=psutil.cpu_percent(interval=0.1),
        memory_percent=psutil.virtual_memory().percent,
        memory_available_mb=psutil.virtual_memory().available / (1024 * 1024),
        disk_usage_percent=psutil.disk_usage("/").percent,
        python_version=sys.version.split()[0],
        uptime_seconds=uptime,
    )

    db_metrics = await get_db_pool_status()
    database_metrics = DatabaseMetrics(**db_metrics)

    return MetricsResponse(system=system_metrics, database=database_metrics)


@router.get(
    "/metrics/database/queries",
    dependencies=[Depends(require_superuser)],
    tags=["Monitoring"],
)
async def get_slow_queries(db: AsyncSession = Depends(get_db)):
    """
    Get slow running queries (PostgreSQL specific).
    Requires superuser authentication.
    """
    query = text("""
        SELECT
            pid,
            now() - query_start AS duration,
            state,
            query
        FROM pg_stat_activity
        WHERE state != 'idle'
        AND query NOT LIKE '%pg_stat_activity%'
        ORDER BY duration DESC
        LIMIT 10
    """)

    result = await db.execute(query)
    rows = result.fetchall()

    return {
        "slow_queries": [
            {
                "pid": row[0],
                "duration_seconds": row[1].total_seconds() if row[1] else 0,
                "state": row[2],
                "query": row[3][:200] if row[3] else "",
            }
            for row in rows
        ]
    }
