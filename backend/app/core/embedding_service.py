# backend/app/core/embedding_service.py
import asyncio
import logging

from app.core.gemini_clients import get_google_genai_sdk_client
from app.models.decision import EMBEDDING_DIM

logger = logging.getLogger(__name__)


def _normalize_dim(values: list[float]) -> list[float]:
    if len(values) == EMBEDDING_DIM:
        return values
    if len(values) > EMBEDDING_DIM:
        logger.warning("Truncating embedding from %s to %s", len(values), EMBEDDING_DIM)
        return values[:EMBEDDING_DIM]
    logger.warning("Padding embedding from %s to %s", len(values), EMBEDDING_DIM)
    return values + [0.0] * (EMBEDDING_DIM - len(values))


def _embed_sync(text: str) -> list[float]:
    text = (text or "").strip() or " "
    try:
        client = get_google_genai_sdk_client()
        if client is None:
            return [0.0] * EMBEDDING_DIM
        response = client.models.embed_content(
            model="text-embedding-004",
            contents=text,
        )
        if hasattr(response, "embeddings") and response.embeddings:
            raw = list(response.embeddings[0].values)
        elif hasattr(response, "embedding") and response.embedding:
            raw = list(response.embedding.values)
        else:
            logger.error("Unexpected embed response shape: %s", response)
            return [0.0] * EMBEDDING_DIM
        return _normalize_dim(raw)
    except Exception:
        logger.exception("Embedding failed for text prefix %r", text[:80])
        return [0.0] * EMBEDDING_DIM


async def get_text_embedding(text: str) -> list[float]:
    """Text → vector (Gemini). Runs the sync client in a thread pool."""
    return await asyncio.to_thread(_embed_sync, text)


def vector_to_pg_literal(values: list[float]) -> str:
    """PostgreSQL vector literal for CAST(:x AS vector(n))."""
    inner = ",".join(str(float(x)) for x in values)
    return f"[{inner}]"
