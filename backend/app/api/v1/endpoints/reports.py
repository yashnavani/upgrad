# backend/app/api/v1/endpoints/reports.py
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_current_user
from app.models.user import User
from app.tasks.ai_tasks import generate_heavy_ai_report

router = APIRouter()


@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
async def trigger_report_generation(
    report_type: Annotated[str, Query(description="Type of report to generate")],
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """
    Enqueue a long-running AI report. Returns immediately so the client does not block.
    """
    await generate_heavy_ai_report.defer_async(
        user_id=str(current_user.id),
        report_type=report_type,
    )

    return {
        "message": "Report generation has been queued successfully.",
        "status": "processing",
    }
