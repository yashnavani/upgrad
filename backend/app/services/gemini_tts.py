# backend/app/services/gemini_tts.py
"""Gemini native TTS (no HeyGen) — PCM from API wrapped as WAV for browser playback."""
from __future__ import annotations

import asyncio
import io
import wave

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.gemini_clients import require_gemini_api_key

# Gemini speech-generation preview models (see Google AI speech docs).
_DEFAULT_TTS_MODEL = "gemini-2.5-flash-preview-tts"
_DEFAULT_VOICE = "Kore"
_PCM_SAMPLE_RATE = 24000


def _pcm_l16_to_wav(pcm: bytes, sample_rate: int = _PCM_SAMPLE_RATE) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)
    return buf.getvalue()


def synthesize_voice_interview_wav_sync(text: str) -> bytes:
    """
    Blocking call: Gemini TTS → mono PCM16 LE @24kHz wrapped in WAV.
    Raises RuntimeError on missing key / empty text / API failure.
    """
    stripped = (text or "").strip()
    if not stripped:
        raise RuntimeError("No text to synthesize.")
    # Long questions: keep TTS input bounded (Gemini TTS still billed per request).
    if len(stripped) > 12_000:
        stripped = stripped[:12_000].rstrip() + "…"

    key = require_gemini_api_key("voice interview TTS")
    model = (settings.GEMINI_TTS_MODEL or _DEFAULT_TTS_MODEL).strip() or _DEFAULT_TTS_MODEL
    voice = (settings.GEMINI_TTS_VOICE or _DEFAULT_VOICE).strip() or _DEFAULT_VOICE

    prompt = (
        "You are a professional interviewer speaking aloud to a candidate. "
        "Use exactly one continuous speaking voice for the entire output — "
        "do not switch voices, genders, or role-play multiple speakers. "
        "Read the following exactly as one interview question — no preamble, "
        "no meta-commentary, no closing remarks:\n\n"
        f"{stripped}"
    )

    client = genai.Client(api_key=key)
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice),
                ),
            ),
        ),
    )

    cand = response.candidates[0] if response.candidates else None
    if not cand or not cand.content or not cand.content.parts:
        raise RuntimeError("Gemini TTS returned no audio.")

    pcm_chunks: list[bytes] = []
    rate = _PCM_SAMPLE_RATE
    for part in cand.content.parts:
        blob = getattr(part, "inline_data", None)
        if blob is None or not getattr(blob, "data", None):
            continue
        mime = (getattr(blob, "mime_type", None) or "").lower()
        if "audio" not in mime and "pcm" not in mime:
            continue
        if "rate=" in mime:
            try:
                frag = mime.split("rate=", 1)[1].split(";", 1)[0].strip()
                rate = int(frag)
            except (ValueError, IndexError):
                rate = _PCM_SAMPLE_RATE
        pcm_chunks.append(blob.data)

    if not pcm_chunks:
        raise RuntimeError("Gemini TTS response missing inline audio data.")
    pcm: bytes = b"".join(pcm_chunks)

    return _pcm_l16_to_wav(pcm, sample_rate=rate)


async def synthesize_voice_interview_wav(text: str) -> bytes:
    return await asyncio.to_thread(synthesize_voice_interview_wav_sync, text)
