# backend/app/api/v1/endpoints/ai.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic_ai.messages import (
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    UserPromptPart,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.ai import ChatRequest, ChatResponse, ToolCallRecord
from app.services.ai_agent import AgentDependencies, master_agent
from app.services.experience_recall import get_similar_past_lessons

router = APIRouter()


@router.post("/chat", response_model=ChatResponse, summary="Communicate with the Cognitive Router")
async def ai_chat_endpoint(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Sends a message to the AI Agent.
    The agent has access to the database and the current user context.
    """
    deps = AgentDependencies(db=db, current_user=current_user)

    message_history: list[ModelRequest | ModelResponse] = []
    for msg in request.history:
        if msg.role == "user":
            message_history.append(ModelRequest(parts=[UserPromptPart(content=msg.content)]))
        elif msg.role == "model":
            message_history.append(ModelResponse(parts=[TextPart(content=msg.content)]))

    try:
        past_lessons = await get_similar_past_lessons(db, request.message)
        contextual_prompt = (
            f"USER REQUEST: {request.message}\n\n"
            f"{past_lessons}\n\n"
            "Instructions: Based on the lessons above, avoid making the same mistakes. "
            "If the user is asking for something that was previously rejected, be extra cautious."
        )
        result = await master_agent.run(
            contextual_prompt,
            deps=deps,
            message_history=message_history or None,
        )

        tools_used: list[ToolCallRecord] = []
        for message in result.new_messages():
            if isinstance(message, ModelResponse):
                for part in message.parts:
                    if isinstance(part, ToolCallPart):
                        tools_used.append(
                            ToolCallRecord(
                                tool_name=part.tool_name,
                                args=part.args_as_dict(),
                            )
                        )

        return ChatResponse(
            reply=result.output,
            tools_used=tools_used,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI execution failed: {e!s}",
        ) from e
