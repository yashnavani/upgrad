# backend/app/services/ai_agent.py
import logging
from dataclasses import dataclass
from datetime import UTC
from typing import Any

from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.gemini import GeminiModel
from pydantic_ai.providers.google_gla import GoogleGLAProvider
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.decision import AgenticDecision
from app.models.user import User

logger = logging.getLogger(__name__)


# 1. Define what the Agent has access to during its run
@dataclass
class AgentDependencies:
    db: AsyncSession
    current_user: User


# 2. Initialize the Model (Gemini via Google GLA; API key from settings)
model = GeminiModel(
    "gemini-2.5-flash",
    provider=GoogleGLAProvider(api_key=settings.GEMINI_API_KEY),
)

# 3. Create the Agent
master_agent = Agent(
    model,
    deps_type=AgentDependencies,
    system_prompt=(
        "You are the Master Foundation AI, an elite operational copilot. "
        "Your job is to assist the user by answering questions and executing tools. "
        "Be concise, professional, and highly accurate. "
        "If you do not know the answer, or lack the tool to perform a task, state so clearly. "
        "For ANY action that modifies data, spends money, deletes records, or materially affects "
        "users or security, you MUST use the propose_high_value_action tool instead of claiming "
        "the action was done. Never pretend a high-impact action ran without human approval."
    ),
)


# 4. Define Tools (The AI's "Hands")
@master_agent.tool
async def get_user_profile(ctx: RunContext[AgentDependencies]) -> str:
    """
    Retrieves the profile information of the currently authenticated user.
    Use this when the user asks 'Who am I?', 'What is my email?', or asks for their details.
    """
    user = ctx.deps.current_user
    logger.info("AI Tool Executed: get_user_profile for User %s", user.id)

    return f"User Name: {user.full_name}, Email: {user.email}, Is Admin: {user.is_superuser}"


@master_agent.tool
async def get_system_time(ctx: RunContext[AgentDependencies]) -> str:
    """
    Gets the current server system time in UTC.
    Use this if the user asks what time it is, or needs a timestamp.
    """
    from datetime import datetime

    current_time = datetime.now(UTC).isoformat()
    logger.info("AI Tool Executed: get_system_time")
    return f"The current system time in UTC is {current_time}"


class ActionProposal(BaseModel):
    """Structured proposal for human-in-the-loop review."""

    action_type: str = Field(..., max_length=100)
    reasoning: str = Field(..., min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(..., ge=0.0, le=1.0)


@master_agent.tool
async def propose_high_value_action(
    ctx: RunContext[AgentDependencies],
    proposal: ActionProposal,
) -> str:
    """
    Use for actions that modify data, spend money, or affect users.
    Execution is paused until a human approves in the Pending Actions center.
    """
    db = ctx.deps.db
    user = ctx.deps.current_user

    new_decision = AgenticDecision(
        action_type=proposal.action_type,
        input_context={
            "trigger": "user_request",
            "requested_by_user_id": str(user.id),
        },
        reasoning=proposal.reasoning,
        proposed_payload=proposal.payload,
        confidence_score=proposal.confidence,
        status="pending",
    )
    db.add(new_decision)
    await db.commit()
    await db.refresh(new_decision)

    logger.info(
        "HITL proposal recorded: id=%s action_type=%s user=%s",
        new_decision.id,
        proposal.action_type,
        user.id,
    )

    return (
        f"I have proposed the action: {proposal.action_type}. "
        f"Reasoning: {proposal.reasoning}. "
        f"Decision ID: {new_decision.id}. "
        "A human must approve this in the Pending Actions center before it can proceed."
    )


async def rejection_lessons_prefix(db: AsyncSession, limit: int = 8) -> str:
    """
    Pull recent human rejections so the model can avoid repeating mistakes.
    (Phase B can replace this with semantic recall over the same table.)
    """
    result = await db.execute(
        select(AgenticDecision)
        .where(
            AgenticDecision.status == "rejected",
            AgenticDecision.is_deleted.is_(False),
            AgenticDecision.feedback_notes.isnot(None),
        )
        .order_by(AgenticDecision.updated_at.desc())
        .limit(limit)
    )
    rows = list(result.scalars().all())
    lines: list[str] = []
    for d in rows:
        fb = (d.feedback_notes or "").strip()
        if not fb:
            continue
        lines.append(
            f"- action_type={d.action_type!r}: human rejected with feedback: {fb}"
        )
    if not lines:
        return ""
    return (
        "Past human feedback (do not repeat these mistakes):\n"
        + "\n".join(lines)
        + "\n"
    )
