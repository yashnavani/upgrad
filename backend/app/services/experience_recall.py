# backend/app/services/experience_recall.py
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.embedding_service import get_text_embedding, vector_to_pg_literal
from app.models.decision import EMBEDDING_DIM
from app.services.ai_agent import rejection_lessons_prefix


async def get_similar_past_lessons(db: AsyncSession, current_request: str) -> str:
    """
    Top similar rejected decisions by L2 distance in embedding space, plus table fallback.
    """
    query_vector = await get_text_embedding(current_request)
    if sum(abs(x) for x in query_vector) < 1e-12:
        alt = await rejection_lessons_prefix(db)
        return (
            alt
            if alt.strip()
            else "No specific past lessons found for this context."
        )

    qv = vector_to_pg_literal(query_vector)
    stmt = text(
        f"""
        SELECT action_type, feedback_notes, reasoning
        FROM agenticdecision
        WHERE status = 'rejected'
          AND is_deleted = false
          AND embedding IS NOT NULL
          AND feedback_notes IS NOT NULL
          AND trim(feedback_notes) <> ''
        ORDER BY embedding <-> CAST(:qv AS vector({EMBEDDING_DIM}))
        LIMIT 3
        """
    )
    result = await db.execute(stmt, {"qv": qv})
    rows = result.mappings().all()

    if not rows:
        alt = await rejection_lessons_prefix(db)
        return (
            alt
            if alt.strip()
            else "No specific past lessons found for this context."
        )

    lines = [
        "CRITICAL LESSONS FROM PAST HUMAN REJECTIONS (semantic recall):",
    ]
    for m in rows:
        fb = (m["feedback_notes"] or "").strip()
        lines.append(
            f"- Action: {m['action_type']} | Human feedback: {fb} | "
            f"AI had argued: {(m['reasoning'] or '')[:200]}"
        )
    return "\n".join(lines) + "\n"
