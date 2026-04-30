# backend/app/services/optimizer.py
from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from google.genai import types
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.gemini_clients import get_google_genai_sdk_client
from app.models.decision import AgenticDecision
from app.models.policy import Policy
from app.models.user import User
from app.services.realtime_push import push_realtime_to_api

logger = logging.getLogger(__name__)

_OPTIMIZER_NAME_PREFIX = "AI Suggestion:"
_MIN_LESSONS = 3
_LESSON_FETCH_LIMIT = 20
_DEDUP_HOURS = 24


def _extract_json_object(text: str) -> dict[str, Any]:
    raw = (text or "").strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw, re.IGNORECASE)
    if fence:
        raw = fence.group(1).strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object in model output")
    return json.loads(raw[start : end + 1])


def _teacher_generate_sync(prompt: str) -> str:
    client = get_google_genai_sdk_client()
    if client is None:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    cfg = types.GenerateContentConfig(
        temperature=0.3,
        max_output_tokens=2048,
        response_mime_type="application/json",
    )
    resp = client.models.generate_content(
        model=settings.GEMINI_TEACHER_MODEL,
        contents=prompt,
        config=cfg,
    )
    if not resp.text:
        raise RuntimeError("Empty teacher model response")
    return resp.text


async def _notify_superusers(db: AsyncSession, title: str, message: str) -> None:
    result = await db.execute(
        select(User.id).where(
            User.is_superuser.is_(True),
            User.is_active.is_(True),
            User.is_deleted.is_(False),
        )
    )
    ids: list[UUID] = list(result.scalars().all())
    payload = {
        "type": "NOTIFICATION",
        "priority": "info",
        "title": title,
        "message": message,
    }
    for uid in ids:
        await push_realtime_to_api(str(uid), payload)


async def _recent_draft_exists(db: AsyncSession) -> bool:
    since = datetime.now(UTC) - timedelta(hours=_DEDUP_HOURS)
    q = await db.execute(
        select(func.count())
        .select_from(Policy)
        .where(
            Policy.is_deleted.is_(False),
            Policy.is_active.is_(False),
            Policy.name.startswith(_OPTIMIZER_NAME_PREFIX),
            Policy.created_at >= since,
        )
    )
    return (q.scalar_one() or 0) > 0


async def _first_superuser_id(db: AsyncSession) -> UUID | None:
    r = await db.execute(
        select(User.id)
        .where(
            User.is_superuser.is_(True),
            User.is_active.is_(True),
            User.is_deleted.is_(False),
        )
        .order_by(User.created_at.asc())
        .limit(1)
    )
    return r.scalar_one_or_none()


async def run_self_optimization(db: AsyncSession) -> str:
    """
    Scan human corrections, ask the teacher model for a global policy draft,
    persist as inactive Policy, and ping superusers via the realtime bus.
    """
    if await _recent_draft_exists(db):
        return "Optimization skipped: a draft proposal already exists in the last 24h."

    result = await db.execute(
        select(AgenticDecision)
        .where(
            and_(
                AgenticDecision.status == "rejected",
                AgenticDecision.action_type == "human_correction",
                AgenticDecision.is_deleted.is_(False),
                AgenticDecision.feedback_notes.isnot(None),
            )
        )
        .order_by(AgenticDecision.updated_at.desc())
        .limit(_LESSON_FETCH_LIMIT)
    )
    lessons = list(result.scalars().all())

    if len(lessons) < _MIN_LESSONS:
        return "Not enough data to optimize yet."

    data_summary = "\n".join(
        f"- User correction: {(lesson.feedback_notes or '').strip()}" for lesson in lessons
    )

    prompt = f"""You are the Teacher module of a Master Foundation agent.
Below are recent human corrections to the AI's behavior (newest first):

{data_summary}

TASK:
1. Identify the single most important recurring pattern (if any). If corrections are
   unrelated, pick the theme that best unifies them.
2. Draft one system-wide policy in plain English that would reduce these mistakes.
3. Give a short policy name and a one-sentence description of why it is needed.

Return a JSON object with exactly these keys:
"name": string,
"description": string,
"refined_instruction": string
"""

    try:
        raw_json = await asyncio.to_thread(_teacher_generate_sync, prompt)
        suggestion = _extract_json_object(raw_json)
    except Exception:
        logger.exception("Teacher model failed during self-optimization")
        return "Teacher model failed; no policy was created."

    name = str(suggestion.get("name", "Untitled")).strip() or "Untitled"
    description = str(suggestion.get("description", "")).strip() or (
        "Synthesized from recurring human feedback."
    )
    refined = str(suggestion.get("refined_instruction", "")).strip()
    if not refined:
        return "Teacher returned no refined_instruction; no policy was created."

    creator_id = await _first_superuser_id(db)
    if creator_id is None:
        return "No superuser exists to attribute the draft policy; skipped."

    lesson_count = len(lessons)
    nl = (
        f"Synthesized from {lesson_count} recent human_correction rejections. "
        f"Pattern summary: {description}"
    )

    new_policy = Policy(
        name=f"{_OPTIMIZER_NAME_PREFIX} {name}",
        description=description,
        natural_language=nl,
        policy_type="natural_language",
        refined_instruction=refined,
        is_active=False,
        creator_id=creator_id,
        tags=["ai-optimized"],
    )
    db.add(new_policy)
    await db.commit()

    await _notify_superusers(
        db,
        "New system optimization",
        f"A draft policy is ready: {name}. Review it under AI Policies → Suggestions.",
    )

    return f"New optimization proposed: {name}"
