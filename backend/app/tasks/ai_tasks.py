# backend/app/tasks/ai_tasks.py
import asyncio
import logging

from app.core.database import AsyncSessionLocal
from app.core.worker import app
from app.services.optimizer import run_self_optimization
from app.services.realtime_push import push_realtime_to_api

logger = logging.getLogger(__name__)


@app.task(queue="ai_jobs")
async def generate_heavy_ai_report(user_id: str, report_type: str) -> None:
    """
    A background task that simulates a massive AI operation.
    Calling .defer_async() enqueues work in Postgres instead of blocking the API.
    """
    logger.info(
        "[WORKER] Starting long-running AI generation for user %s...", user_id
    )

    await asyncio.sleep(15)

    await push_realtime_to_api(
        user_id,
        {
            "type": "NOTIFICATION",
            "priority": "success",
            "title": "AI Analysis Complete",
            "message": f"Your {report_type} report has been successfully generated.",
        },
    )

    logger.info(
        "[WORKER] Report %r done; realtime push sent for user %s.",
        report_type,
        user_id,
    )


@app.periodic(cron="0 3 * * *")
@app.task(queue="ai_jobs")
async def daily_system_optimization(timestamp: int) -> None:
    """
    Nightly scan of human corrections → draft policy + realtime ping to superusers.
    Requires a running Procrastinate worker so periodic deferral occurs.
    """
    logger.info("[WORKER] Daily self-optimization scheduled (ts=%s)", timestamp)
    async with AsyncSessionLocal() as db:
        status = await run_self_optimization(db)
    logger.info("[WORKER] [OPTIMIZER] %s", status)
