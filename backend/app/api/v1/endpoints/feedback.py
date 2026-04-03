# backend/app/api/v1/endpoints/feedback.py
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.embedding_service import get_text_embedding, vector_to_pg_literal
from app.models.decision import EMBEDDING_DIM, AgenticDecision
from app.models.user import User
from app.schemas.feedback import FeedbackSubmit

router = APIRouter()


@router.post("/teach", summary="Directly teach the AI a new lesson")
async def submit_ai_feedback(
    data: FeedbackSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """
    Store a human correction as a rejected journal row with a semantic embedding
    so Phase B recall can surface it on similar prompts.
    """
    lesson_text = (
        f"Context: {data.original_prompt.strip()} | Correction: {data.correction.strip()}"
    )
    vector = await get_text_embedding(lesson_text)

    new_lesson = AgenticDecision(
        action_type="human_correction",
        input_context={
            "prompt": data.original_prompt,
            "ai_response": data.ai_response,
            "source": "feedback_teach",
        },
        reasoning=data.ai_response,
        proposed_payload={},
        confidence_score=0.0,
        status="rejected",
        feedback_notes=data.correction,
        approver_id=current_user.id,
    )
    db.add(new_lesson)
    await db.flush()

    await db.execute(
        text(
            f"UPDATE agenticdecision SET embedding = CAST(:emb AS vector({EMBEDDING_DIM})) "
            "WHERE id = :id"
        ),
        {"emb": vector_to_pg_literal(vector), "id": new_lesson.id},
    )
    await db.commit()

    return {"message": "AI successfully updated. I will remember this for next time."}
