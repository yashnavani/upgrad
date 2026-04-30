# backend/app/services/interview_agents.py
import json
import logging
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.messages import ModelRequest, ModelResponse, TextPart, UserPromptPart

from app.core.gemini_clients import get_pydantic_gemini_flash_model
from app.core.interview_constants import INTERVIEW_DEFAULT_MAX_TURNS

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def _load_prompt(name: str) -> str:
    path = PROMPTS_DIR / name
    if not path.is_file():
        raise RuntimeError(f"Missing prompt file: {path}")
    return path.read_text(encoding="utf-8")


def _inject_placeholders(template: str, pairs: list[tuple[str, str]]) -> str:
    """Replace known `{key}` tokens; put user text last in `pairs` so it cannot steal keys."""
    out = template
    for token, value in pairs:
        out = out.replace(token, value)
    return out


class EvaluationResult(BaseModel):
    communication_score: int = Field(ge=1, le=10)
    communication_notes: str
    technical_accuracy_score: int = Field(ge=1, le=10)
    technical_notes: str
    problem_solving_score: int = Field(ge=1, le=10)
    problem_solving_notes: str
    behavioral_fit_score: int = Field(ge=1, le=10)
    behavioral_notes: str


def _history_to_messages(history: list[dict[str, Any]]) -> list[ModelRequest | ModelResponse]:
    messages: list[ModelRequest | ModelResponse] = []
    for msg in history:
        role = msg.get("role")
        content = msg.get("content", "")
        if role == "user":
            messages.append(ModelRequest(parts=[UserPromptPart(content=str(content))]))
        elif role == "model":
            messages.append(ModelResponse(parts=[TextPart(content=str(content))]))
    return messages


def _interviewer_turn_instruction(history: list[dict[str, Any]], max_turns: int) -> str:
    """Runtime instructions so the model paces and adapts across several answer rounds."""
    user_answers = sum(1 for m in history if m.get("role") == "user")
    if user_answers == 0:
        return (
            f"OPENING: This session will end after exactly {max_turns} candidate answers, then evaluation. "
            "Ask ONE strong first question grounded in the target role, focus area, and resume (if any). "
            "Avoid a throwaway icebreaker unless it tees up real depth."
        )
    remaining = max_turns - user_answers
    return (
        f"PROGRESS: The candidate has given {user_answers} answer(s); "
        f"{remaining} candidate answer(s) remain in this interview (including their reply to your next question). "
        "Adapt: weak or generic last answer → one sharp follow-up; strong last answer → move forward with a harder or "
        "wider angle. Calibrate difficulty to their level. React only to their last answer—no fixed question list. "
        "Output ONLY your next spoken line (brief bridge + ONE question)."
    )


async def generate_interview_turn(
    target_role: str,
    focus_area: str,
    resume_snippet: str | None,
    history: list[dict[str, Any]],
    max_turns: int = INTERVIEW_DEFAULT_MAX_TURNS,
) -> str:
    system = _inject_placeholders(
        _load_prompt("interviewer.md"),
        [
            ("{target_role}", target_role),
            ("{focus_area}", focus_area),
            ("{resume_snippet}", resume_snippet or "No resume provided."),
        ],
    )
    agent = Agent(get_pydantic_gemini_flash_model(), system_prompt=system)
    message_history = _history_to_messages(history) or None
    instruction = _interviewer_turn_instruction(history, max_turns)
    result = await agent.run(instruction, message_history=message_history)
    return str(result.output)


async def evaluate_and_coach(
    target_role: str,
    focus_area: str,
    history: list[dict[str, Any]],
    resume_snippet: str | None = None,
) -> dict[str, Any]:
    transcript_text = "\n".join(
        f"{str(m.get('role', '')).upper()}: {m.get('content', '')}" for m in history
    )
    resume_block = (resume_snippet or "").strip() or "Not provided."

    eval_system = _inject_placeholders(
        _load_prompt("evaluator.md"),
        [
            ("{target_role}", target_role),
            ("{focus_area}", focus_area),
            ("{resume_snippet}", resume_block),
        ],
    )
    evaluator = Agent(
        get_pydantic_gemini_flash_model(),
        output_type=EvaluationResult,
        system_prompt=eval_system,
    )
    eval_run = await evaluator.run(
        "Score each of the four dimensions independently (do not collapse to one overall judgment).\n\n"
        f"Transcript:\n\n{transcript_text}"
    )
    evaluation = eval_run.output
    if not isinstance(evaluation, EvaluationResult):
        logger.warning("Evaluator returned unexpected type: %s", type(evaluation))
        raise RuntimeError("Evaluator did not return structured scores")
    evaluation_json = evaluation.model_dump()

    coach_system = _inject_placeholders(
        _load_prompt("coach.md"),
        [
            ("{target_role}", target_role),
            ("{focus_area}", focus_area),
        ],
    )
    coach = Agent(get_pydantic_gemini_flash_model(), system_prompt=coach_system)
    coach_input = (
        f"Candidate resume summary:\n{resume_block}\n\n"
        f"Transcript:\n{transcript_text}\n\n"
        f"Evaluator scores (JSON):\n{json.dumps(evaluation_json, indent=2)}"
    )
    coach_run = await coach.run(coach_input)

    return {
        "evaluation": evaluation_json,
        "coaching_report": str(coach_run.output),
    }
