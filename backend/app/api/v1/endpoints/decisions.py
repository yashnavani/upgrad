# backend/app/api/v1/endpoints/decisions.py
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defer

from app.api.deps import get_db, require_superuser
from app.core.embedding_service import get_text_embedding, vector_to_pg_literal
from app.models.decision import EMBEDDING_DIM, AgenticDecision
from app.models.user import User
from app.schemas.decision import DecisionRead, RejectDecisionBody

router = APIRouter()


@router.get("/pending", response_model=list[DecisionRead])
async def list_pending_decisions(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_superuser),
) -> list[AgenticDecision]:
    result = await db.execute(
        select(AgenticDecision)
        .where(
            AgenticDecision.status == "pending",
            AgenticDecision.is_deleted.is_(False),
        )
        .order_by(AgenticDecision.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/{decision_id}/approve")
async def approve_decision(
    decision_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superuser),
    notes: str | None = Query(None, max_length=8000),
) -> dict[str, str]:
    result = await db.execute(
        select(AgenticDecision)
        .options(defer(AgenticDecision.embedding))
        .where(
            AgenticDecision.id == decision_id,
            AgenticDecision.is_deleted.is_(False),
        )
    )
    decision = result.scalar_one_or_none()

    if not decision or decision.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or non-pending decision.",
        )

    decision.status = "approved"
    decision.feedback_notes = notes
    decision.approver_id = current_user.id

    # Phase B+: dispatch to real automation from action_type + proposed_payload
    await db.commit()

    return {
        "message": f"Action {decision.action_type} approved. "
        "Execution hook can run from proposed_payload.",
    }


@router.post("/{decision_id}/reject")
async def reject_decision(
    decision_id: UUID,
    body: RejectDecisionBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superuser),
) -> dict[str, str]:
    result = await db.execute(
        select(AgenticDecision)
        .options(defer(AgenticDecision.embedding))
        .where(
            AgenticDecision.id == decision_id,
            AgenticDecision.is_deleted.is_(False),
        )
    )
    decision = result.scalar_one_or_none()

    if not decision:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    if decision.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision is not pending.",
        )

    embed_text = (
        f"action_type: {decision.action_type}\n"
        f"ai_reasoning: {decision.reasoning}\n"
        f"human_rejection: {body.reason}"
    )
    vec = await get_text_embedding(embed_text)
    emb_lit = vector_to_pg_literal(vec)

    upd = await db.execute(
        text(
            f"""
            UPDATE agenticdecision
            SET status = :st,
                feedback_notes = :fb,
                approver_id = :aid,
                updated_at = CURRENT_TIMESTAMP,
                embedding = CAST(:emb AS vector({EMBEDDING_DIM}))
            WHERE id = :id
              AND is_deleted = false
              AND status = 'pending'
            """
        ),
        {
            "st": "rejected",
            "fb": body.reason,
            "aid": current_user.id,
            "emb": emb_lit,
            "id": decision_id,
        },
    )
    if upd.rowcount != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not reject decision (race or invalid state).",
        )

    await db.commit()

    return {"message": "AI action rejected. Feedback recorded for learning."}
