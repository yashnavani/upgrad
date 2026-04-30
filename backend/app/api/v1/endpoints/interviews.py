# backend/app/api/v1/endpoints/interviews.py
import logging
from typing import Any
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.interview_constants import INTERVIEW_DEFAULT_MAX_TURNS
from app.models.interview import InterviewSession
from app.models.user import User
from app.schemas.interview import (
    InterviewCreate,
    InterviewResponse,
    InterviewTurn,
    LiveAvatarStatusOut,
    LiveAvatarTokenOut,
    ResumeParseOut,
    VoiceTtsIn,
)
from app.services.gemini_tts import synthesize_voice_interview_wav
from app.services.interview_agents import evaluate_and_coach, generate_interview_turn
from app.utils.resume_text import extract_resume_text

router = APIRouter()
logger = logging.getLogger(__name__)

LIVEAVATAR_TOKEN_URL = "https://api.liveavatar.com/v1/sessions/token"
MAX_RESUME_UPLOAD_BYTES = 6 * 1024 * 1024
MAX_RESUME_TEXT_CHARS = 50_000


@router.get(
    "/liveavatar-status",
    response_model=LiveAvatarStatusOut,
    status_code=status.HTTP_200_OK,
)
async def liveavatar_status(_current_user: User = Depends(get_current_user)):
    """True when both HeyGen env vars are set; client should skip token POST if false."""
    key = (settings.LIVEAVATAR_API_KEY or "").strip()
    aid = (settings.LIVEAVATAR_AVATAR_ID or "").strip()
    return LiveAvatarStatusOut(available=bool(key and aid))


def _liveavatar_avatar_id_or_422() -> str:
    avatar_id = (settings.LIVEAVATAR_AVATAR_ID or "").strip()
    if not avatar_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="LIVEAVATAR_AVATAR_ID is not configured.",
        )
    return avatar_id


def _liveavatar_token_payload_lite() -> dict[str, Any]:
    return {
        "mode": "LITE",
        "avatar_id": _liveavatar_avatar_id_or_422(),
        "is_sandbox": settings.LIVEAVATAR_USE_SANDBOX,
    }


def _liveavatar_token_payload_full(*, include_voice: bool) -> dict[str, Any]:
    persona: dict[str, Any] = {
        "language": (settings.LIVEAVATAR_LANGUAGE or "en").strip() or "en",
    }
    ctx = (settings.LIVEAVATAR_CONTEXT_ID or "").strip()
    if ctx:
        persona["context_id"] = ctx
    if include_voice:
        voice = (settings.LIVEAVATAR_VOICE_ID or "").strip()
        if voice:
            persona["voice_id"] = voice
    return {
        "mode": "FULL",
        "avatar_id": _liveavatar_avatar_id_or_422(),
        "is_sandbox": settings.LIVEAVATAR_USE_SANDBOX,
        "avatar_persona": persona,
        "interactivity_type": "PUSH_TO_TALK",
    }


def _liveavatar_error_detail(res: httpx.Response) -> str:
    raw = (res.text or "")[:2000]
    try:
        body = res.json()
    except Exception:
        return raw or res.reason_phrase
    if not isinstance(body, dict):
        return raw or res.reason_phrase
    msg = body.get("message")
    if isinstance(msg, str) and msg.strip():
        return msg.strip()
    detail = body.get("detail")
    if isinstance(detail, str) and detail.strip():
        return detail.strip()
    if isinstance(detail, list):
        parts: list[str] = []
        for item in detail:
            if isinstance(item, dict):
                loc = item.get("loc", [])
                m = item.get("msg", "")
                parts.append(f"{loc}: {m}" if loc or m else str(item))
        if parts:
            return "; ".join(parts)[:2000]
    return raw or res.reason_phrase


def _liveavatar_token_payloads_to_try() -> list[dict[str, Any]]:
    """Try FULL with optional voice first; on 422 LiveAvatar often rejects mismatched voice_id."""
    if settings.LIVEAVATAR_SESSION_MODE == "LITE":
        return [_liveavatar_token_payload_lite()]
    out: list[dict[str, Any]] = []
    voice_set = bool((settings.LIVEAVATAR_VOICE_ID or "").strip())
    out.append(_liveavatar_token_payload_full(include_voice=True))
    if voice_set:
        out.append(_liveavatar_token_payload_full(include_voice=False))
    out.append(_liveavatar_token_payload_lite())
    return out


def _parse_liveavatar_token_body(body: object) -> LiveAvatarTokenOut:
    if not isinstance(body, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="LiveAvatar returned a non-JSON object.",
        )
    data = body.get("data")
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="LiveAvatar returned an unexpected response shape (missing data).",
        )
    token = data.get("session_token")
    sid = data.get("session_id")
    if not token or not sid:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="LiveAvatar response missing session_token or session_id.",
        )
    return LiveAvatarTokenOut(session_token=str(token), session_id=str(sid))


@router.post(
    "/liveavatar-token",
    response_model=LiveAvatarTokenOut,
    status_code=status.HTTP_200_OK,
)
async def mint_liveavatar_token(_current_user: User = Depends(get_current_user)):
    """Mint LiveAvatar SDK session token (API key stays on server)."""
    api_key = (settings.LIVEAVATAR_API_KEY or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="LIVEAVATAR_API_KEY is not configured.",
        )
    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    payloads = _liveavatar_token_payloads_to_try()
    last_detail = ""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for i, payload in enumerate(payloads):
                res = await client.post(LIVEAVATAR_TOKEN_URL, headers=headers, json=payload)
                if res.status_code == status.HTTP_200_OK:
                    if i > 0:
                        logger.warning(
                            "LiveAvatar token succeeded with fallback payload index=%s (mode=%s)",
                            i,
                            payload.get("mode"),
                        )
                    try:
                        body = res.json()
                    except Exception as e:
                        raise HTTPException(
                            status_code=status.HTTP_502_BAD_GATEWAY,
                            detail="LiveAvatar returned invalid JSON.",
                        ) from e
                    return _parse_liveavatar_token_body(body)

                last_detail = _liveavatar_error_detail(res)
                if res.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN):
                    raise HTTPException(status_code=res.status_code, detail=last_detail)
                if status.HTTP_400 <= res.status_code < 500:
                    if res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY and i + 1 < len(
                        payloads
                    ):
                        continue
                    raise HTTPException(status_code=res.status_code, detail=last_detail)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"LiveAvatar API error ({res.status_code}): {last_detail}",
                )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LiveAvatar token request failed: {e!s}",
        ) from e


@router.post(
    "/voice-tts",
    status_code=status.HTTP_200_OK,
)
async def voice_interview_tts(
    data: VoiceTtsIn,
    _current_user: User = Depends(get_current_user),
):
    """Gemini native TTS as WAV (voice-only mock interview; not HeyGen)."""
    try:
        wav = await synthesize_voice_interview_wav(data.text)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e
    except Exception as e:
        logger.exception("Gemini TTS failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"TTS failed: {e!s}",
        ) from e
    return Response(content=wav, media_type="audio/wav")


@router.post(
    "/parse-resume",
    response_model=ResumeParseOut,
    status_code=status.HTTP_200_OK,
)
async def parse_resume_upload(
    file: UploadFile = File(...),
    _current_user: User = Depends(get_current_user),
):
    """Extract plain text from PDF, DOCX, or TXT for use as interview resume context."""
    raw = await file.read()
    if len(raw) > MAX_RESUME_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Resume file too large (max 6 MB).",
        )
    name = file.filename or "resume.txt"
    try:
        text = extract_resume_text(name, raw)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    text = "\n".join(line.strip() for line in text.splitlines() if line.strip()).strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract readable text from this file.",
        )

    truncated = len(text) > MAX_RESUME_TEXT_CHARS
    if truncated:
        text = (
            text[:MAX_RESUME_TEXT_CHARS].rstrip()
            + "\n\n[Trimmed to maximum length for interview context.]"
        )
    return ResumeParseOut(text=text, truncated=truncated, filename=name)


@router.get("", response_model=list[InterviewResponse])
async def list_interviews(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 20,
):
    """Recent mock interview sessions for the current user (newest first)."""
    lim = max(1, min(int(limit), 50))
    result = await db.execute(
        select(InterviewSession)
        .where(
            InterviewSession.owner_id == current_user.id,
            InterviewSession.is_deleted.is_(False),
        )
        .order_by(InterviewSession.updated_at.desc())
        .limit(lim)
    )
    return list(result.scalars().all())


@router.post("", response_model=InterviewResponse, status_code=status.HTTP_201_CREATED)
async def create_interview(
    data: InterviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mt = data.max_turns if data.max_turns is not None else INTERVIEW_DEFAULT_MAX_TURNS
    session = InterviewSession(
        owner_id=current_user.id,
        target_role=data.target_role,
        focus_area=data.focus_area,
        resume_snippet=data.resume_snippet,
        transcript=[],
        max_turns=mt,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    try:
        first_question = await generate_interview_turn(
            session.target_role,
            session.focus_area,
            session.resume_snippet,
            [],
            session.max_turns,
        )
    except RuntimeError as e:
        await db.delete(session)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        ) from e
    except Exception as e:
        await db.delete(session)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start interview: {e!s}",
        ) from e

    session.transcript = [{"role": "model", "content": first_question}]
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/{session_id}", response_model=InterviewResponse)
async def get_interview(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(InterviewSession).where(
            InterviewSession.id == session_id,
            InterviewSession.is_deleted.is_(False),
        )
    )
    session = result.scalar_one_or_none()
    if not session or session.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found")
    return session


@router.post("/{session_id}/turn", response_model=InterviewResponse)
async def submit_turn(
    session_id: UUID,
    data: InterviewTurn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(InterviewSession).where(
            InterviewSession.id == session_id,
            InterviewSession.is_deleted.is_(False),
        )
    )
    session = result.scalar_one_or_none()
    if not session or session.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found")
    if session.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Interview is already completed.",
        )

    transcript = list(session.transcript)
    transcript.append({"role": "user", "content": data.answer})
    session.turn_count += 1

    if session.turn_count >= session.max_turns:
        session.status = "completed"
        try:
            feedback = await evaluate_and_coach(
                session.target_role,
                session.focus_area,
                transcript,
                session.resume_snippet,
            )
        except RuntimeError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(e),
            ) from e
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Evaluation failed: {e!s}",
            ) from e
        session.feedback_data = feedback
    else:
        try:
            next_q = await generate_interview_turn(
                session.target_role,
                session.focus_area,
                session.resume_snippet,
                transcript,
                session.max_turns,
            )
        except RuntimeError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(e),
            ) from e
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Interviewer failed: {e!s}",
            ) from e
        transcript.append({"role": "model", "content": next_q})

    session.transcript = transcript
    await db.commit()
    await db.refresh(session)
    return session
