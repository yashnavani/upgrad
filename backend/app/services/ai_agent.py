# backend/app/services/ai_agent.py
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.gemini_clients import get_pydantic_gemini_flash_model
from app.models.decision import AgenticDecision
from app.models.user import User

logger = logging.getLogger(__name__)

# Lazily built so the API process can boot without GEMINI_API_KEY (chat returns 503 until set).
_master_agent: Agent | None = None


@dataclass
class AgentDependencies:
    db: AsyncSession
    current_user: User


class ActionProposal(BaseModel):
    """Structured proposal for human-in-the-loop review."""

    action_type: str = Field(..., max_length=100)
    reasoning: str = Field(..., min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(..., ge=0.0, le=1.0)


def _create_master_agent() -> Agent:
    model = get_pydantic_gemini_flash_model()
    agent = Agent(
        model,
        deps_type=AgentDependencies,
        system_prompt=(
            "You are the Luminous workspace copilot, an elite operational assistant. "
            "Your job is to assist the user by answering questions and executing tools. "
            "Be concise, professional, and highly accurate. "
            "If you do not know the answer, or lack the tool to perform a task, state so clearly. "
            "For ANY action that modifies data, spends money, deletes records, or materially "
            "affects users or security, you MUST use the propose_high_value_action tool instead "
            "of claiming the action was done. Never pretend a high-impact action ran without "
            "human approval."
        ),
    )

    @agent.tool
    async def get_user_profile(ctx: RunContext[AgentDependencies]) -> str:
        """
        Retrieves the profile information of the currently authenticated user.
        Use this when the user asks 'Who am I?', 'What is my email?', or asks for their details.
        """
        user = ctx.deps.current_user
        logger.info("AI Tool Executed: get_user_profile for User %s", user.id)

        return f"User Name: {user.full_name}, Email: {user.email}, Is Admin: {user.is_superuser}"

    @agent.tool
    async def get_system_time(ctx: RunContext[AgentDependencies]) -> str:
        """
        Gets the current server system time in UTC.
        Use this if the user asks what time it is, or needs a timestamp.
        """

        current_time = datetime.now(UTC).isoformat()
        logger.info("AI Tool Executed: get_system_time")
        return f"The current system time in UTC is {current_time}"

    @agent.tool
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

    return agent


def get_master_agent() -> Agent:
    """Return the singleton agent, building it on first use."""
    global _master_agent
    if _master_agent is None:
        _master_agent = _create_master_agent()
    return _master_agent


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
