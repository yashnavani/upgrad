# backend/app/schemas/ai.py
from typing import Any

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'model'")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., description="The user's input prompt")
    history: list[ChatMessage] = Field(
        default_factory=list,
        description="Previous conversation context",
    )


class ToolCallRecord(BaseModel):
    tool_name: str
    args: dict[str, Any]


class ChatResponse(BaseModel):
    reply: str = Field(..., description="The AI's natural language response")
    tools_used: list[ToolCallRecord] = Field(
        default_factory=list,
        description="Audit trail of tools the AI decided to use",
    )
