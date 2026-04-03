# backend/app/schemas/feedback.py
from pydantic import BaseModel, Field


class FeedbackSubmit(BaseModel):
    original_prompt: str = Field(..., max_length=16000)
    ai_response: str = Field(..., max_length=32000)
    correction: str = Field(..., min_length=1, max_length=16000)
