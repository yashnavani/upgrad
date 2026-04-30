# backend/app/core/gemini_clients.py
"""
Single integration point for Google Gemini.

All features use this module instead of constructing ``genai.Client`` or
``GeminiModel`` locally — avoids divergent key handling, model IDs, and
singleton bugs when debugging.
"""
from __future__ import annotations

from google import genai
from pydantic_ai.models.gemini import GeminiModel
from pydantic_ai.providers.google_gla import GoogleGLAProvider

from app.core.config import settings

_google_genai_sdk_client: genai.Client | None = None
_pydantic_gemini_flash: GeminiModel | None = None


def gemini_api_key_stripped() -> str:
    return (settings.GEMINI_API_KEY or "").strip()


def require_gemini_api_key(usage: str) -> str:
    key = gemini_api_key_stripped()
    if not key:
        raise RuntimeError(
            f"GEMINI_API_KEY is not configured. Set it in your environment (e.g. repo-root .env) "
            f"to enable {usage}."
        )
    return key


def get_google_genai_sdk_client() -> genai.Client | None:
    """
    Shared ``google.genai.Client`` for embeddings, teacher JSON, etc.

    Returns ``None`` when no key (callers that must degrade gracefully, e.g. embeddings).
    """
    global _google_genai_sdk_client
    key = gemini_api_key_stripped()
    if not key:
        return None
    if _google_genai_sdk_client is None:
        _google_genai_sdk_client = genai.Client(api_key=key)
    return _google_genai_sdk_client


def get_pydantic_gemini_flash_model() -> GeminiModel:
    """Shared ``gemini-2.5-flash`` for every pydantic-ai ``Agent`` (workspace chat, interviews)."""
    global _pydantic_gemini_flash
    if _pydantic_gemini_flash is None:
        key = require_gemini_api_key(
            "/ai/chat, mock interviews, and other PydanticAI Gemini agents"
        )
        _pydantic_gemini_flash = GeminiModel(
            "gemini-2.5-flash",
            provider=GoogleGLAProvider(api_key=key),
        )
    return _pydantic_gemini_flash


def reset_gemini_clients_for_testing() -> None:
    """Drop cached clients (use after monkeypatching ``settings`` in tests)."""
    global _google_genai_sdk_client, _pydantic_gemini_flash
    _google_genai_sdk_client = None
    _pydantic_gemini_flash = None
