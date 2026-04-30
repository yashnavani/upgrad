# backend/tests/test_interviews.py
"""Mock interview + LiveAvatar token routes (Gemini / HeyGen mocked or absent)."""
from uuid import UUID, uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.models.interview import InterviewSession

BASE = "/api/v1/interviews"


@pytest.mark.asyncio
async def test_liveavatar_token_no_db_actor(client: AsyncClient):
    r = await client.post(f"{BASE}/liveavatar-token")
    assert r.status_code in (422, 503)


@pytest.mark.asyncio
async def test_liveavatar_token_missing_api_key(auth_client: AsyncClient, monkeypatch):
    from app.api.v1.endpoints import interviews as iv
    from app.core.config import settings

    fake = settings.model_copy(update={"LIVEAVATAR_API_KEY": "", "LIVEAVATAR_AVATAR_ID": ""})
    monkeypatch.setattr(iv, "settings", fake)
    r = await auth_client.post(f"{BASE}/liveavatar-token")
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_liveavatar_token_missing_avatar_id(auth_client: AsyncClient, monkeypatch):
    from app.api.v1.endpoints import interviews as iv
    from app.core.config import settings

    fake = settings.model_copy(
        update={"LIVEAVATAR_API_KEY": "test-key-only", "LIVEAVATAR_AVATAR_ID": ""}
    )
    monkeypatch.setattr(iv, "settings", fake)
    r = await auth_client.post(f"{BASE}/liveavatar-token")
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_liveavatar_status_no_db_actor(client: AsyncClient):
    r = await client.get(f"{BASE}/liveavatar-status")
    assert r.status_code in (200, 503)


@pytest.mark.asyncio
async def test_liveavatar_status_false_when_unconfigured(auth_client: AsyncClient, monkeypatch):
    from app.api.v1.endpoints import interviews as iv
    from app.core.config import settings

    fake = settings.model_copy(update={"LIVEAVATAR_API_KEY": "", "LIVEAVATAR_AVATAR_ID": ""})
    monkeypatch.setattr(iv, "settings", fake)
    r = await auth_client.get(f"{BASE}/liveavatar-status")
    assert r.status_code == 200
    assert r.json() == {"available": False}


@pytest.mark.asyncio
async def test_liveavatar_status_true_when_configured(auth_client: AsyncClient, monkeypatch):
    from app.api.v1.endpoints import interviews as iv
    from app.core.config import settings

    fake = settings.model_copy(
        update={
            "LIVEAVATAR_API_KEY": "k",
            "LIVEAVATAR_AVATAR_ID": "00000000-0000-4000-8000-000000000001",
        }
    )
    monkeypatch.setattr(iv, "settings", fake)
    r = await auth_client.get(f"{BASE}/liveavatar-status")
    assert r.status_code == 200
    assert r.json() == {"available": True}


@pytest.mark.asyncio
async def test_list_interviews_no_db_actor(client: AsyncClient):
    r = await client.get(BASE)
    assert r.status_code in (200, 503)


@pytest.mark.asyncio
async def test_list_interviews_empty(auth_client: AsyncClient):
    r = await auth_client.get(BASE)
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_list_interviews_returns_sessions(auth_client: AsyncClient, monkeypatch):
    async def fake_turn(*_a, **_k):
        return "First question?"

    monkeypatch.setattr(
        "app.api.v1.endpoints.interviews.generate_interview_turn",
        fake_turn,
    )
    await auth_client.post(
        BASE,
        json={"target_role": "SRE", "focus_area": "technical"},
    )
    r = await auth_client.get(BASE)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["target_role"] == "SRE"
    assert "updated_at" in data[0]


@pytest.mark.asyncio
async def test_parse_resume_no_db_actor(client: AsyncClient):
    files = {"file": ("cv.txt", b"hello", "text/plain")}
    r = await client.post(f"{BASE}/parse-resume", files=files)
    assert r.status_code in (200, 400, 503)


@pytest.mark.asyncio
async def test_parse_resume_txt(auth_client: AsyncClient):
    files = {"file": ("cv.txt", b"Senior engineer at Acme Corp.\nBuilt APIs.", "text/plain")}
    r = await auth_client.post(f"{BASE}/parse-resume", files=files)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "Acme" in data["text"]
    assert data["truncated"] is False


@pytest.mark.asyncio
async def test_parse_resume_bad_extension(auth_client: AsyncClient):
    files = {"file": ("x.exe", b"abc", "application/octet-stream")}
    r = await auth_client.post(f"{BASE}/parse-resume", files=files)
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_create_and_get_interview(auth_client: AsyncClient, monkeypatch):
    async def fake_turn(*_a, **_k):
        return "Walk me through a recent project."

    monkeypatch.setattr(
        "app.api.v1.endpoints.interviews.generate_interview_turn",
        fake_turn,
    )
    r = await auth_client.post(
        BASE,
        json={
            "target_role": "Backend Engineer",
            "focus_area": "technical",
            "resume_snippet": None,
        },
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["target_role"] == "Backend Engineer"
    assert data["status"] == "in_progress"
    assert data["turn_count"] == 0
    assert data["max_turns"] == 6
    assert data["transcript"][-1]["role"] == "model"
    sid = data["id"]

    g = await auth_client.get(f"{BASE}/{sid}")
    assert g.status_code == 200
    assert g.json()["id"] == sid


@pytest.mark.asyncio
async def test_create_interview_respects_max_turns(auth_client: AsyncClient, monkeypatch):
    async def fake_turn(*_a, **_k):
        return "Q?"

    monkeypatch.setattr(
        "app.api.v1.endpoints.interviews.generate_interview_turn",
        fake_turn,
    )
    r = await auth_client.post(
        BASE,
        json={"target_role": "Analyst", "focus_area": "case", "max_turns": 7},
    )
    assert r.status_code == 201, r.text
    assert r.json()["max_turns"] == 7


@pytest.mark.asyncio
async def test_create_interview_max_turns_validation(auth_client: AsyncClient):
    r = await auth_client.post(
        BASE,
        json={"target_role": "X", "focus_area": "mixed", "max_turns": 4},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_get_interview_not_found(auth_client: AsyncClient):
    r = await auth_client.get(f"{BASE}/{uuid4()}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_submit_turn_appends_model_question(
    auth_client: AsyncClient, monkeypatch
):
    calls = {"n": 0}

    async def fake_turn(*_a, **_k):
        calls["n"] += 1
        return f"Follow-up question #{calls['n']}?"

    monkeypatch.setattr(
        "app.api.v1.endpoints.interviews.generate_interview_turn",
        fake_turn,
    )
    created = (
        await auth_client.post(
            BASE,
            json={"target_role": "PM", "focus_area": "behavioral"},
        )
    ).json()
    sid = created["id"]

    r = await auth_client.post(
        f"{BASE}/{sid}/turn",
        json={"answer": "I led a roadmap workshop with five stakeholders."},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["turn_count"] == 1
    assert len(body["transcript"]) == 3
    assert body["transcript"][-1]["role"] == "model"


@pytest.mark.asyncio
async def test_final_turn_runs_evaluator(
    auth_client: AsyncClient, db_session, monkeypatch
):
    async def fake_turn(*_a, **_k):
        return "Closing question?"

    async def fake_eval(*_a, **_k):
        return {
            "evaluation": {
                "communication_score": 8,
                "communication_notes": "Clear.",
                "technical_accuracy_score": 7,
                "technical_notes": "Adequate.",
                "problem_solving_score": 7,
                "problem_solving_notes": "Structured.",
                "behavioral_fit_score": 8,
                "behavioral_notes": "Positive.",
            },
            "coaching_report": "## Summary\nSolid effort.",
        }

    monkeypatch.setattr(
        "app.api.v1.endpoints.interviews.generate_interview_turn",
        fake_turn,
    )
    monkeypatch.setattr(
        "app.api.v1.endpoints.interviews.evaluate_and_coach",
        fake_eval,
    )

    created = (
        await auth_client.post(
            BASE,
            json={"target_role": "Intern", "focus_area": "mixed"},
        )
    ).json()
    sid = UUID(created["id"])

    await db_session.execute(
        update(InterviewSession).where(InterviewSession.id == sid).values(max_turns=1)
    )
    await db_session.commit()

    r2 = await auth_client.post(
        f"{BASE}/{sid}/turn",
        json={"answer": "I would prioritize learning the codebase first."},
    )
    assert r2.status_code == 200, r2.text
    out = r2.json()
    assert out["status"] == "completed"
    assert out["feedback_data"]["evaluation"]["communication_score"] == 8
    assert "Summary" in out["feedback_data"]["coaching_report"]


@pytest.mark.asyncio
async def test_submit_turn_rejects_when_completed(
    auth_client: AsyncClient, db_session, monkeypatch
):
    async def fake_turn(*_a, **_k):
        return "Q?"

    async def fake_eval(*_a, **_k):
        return {
            "evaluation": {
                "communication_score": 5,
                "communication_notes": "x",
                "technical_accuracy_score": 5,
                "technical_notes": "x",
                "problem_solving_score": 5,
                "problem_solving_notes": "x",
                "behavioral_fit_score": 5,
                "behavioral_notes": "x",
            },
            "coaching_report": "ok",
        }

    monkeypatch.setattr(
        "app.api.v1.endpoints.interviews.generate_interview_turn",
        fake_turn,
    )
    monkeypatch.setattr(
        "app.api.v1.endpoints.interviews.evaluate_and_coach",
        fake_eval,
    )

    created = (
        await auth_client.post(
            BASE,
            json={"target_role": "X", "focus_area": "technical"},
        )
    ).json()
    sid = UUID(created["id"])
    await db_session.execute(
        update(InterviewSession).where(InterviewSession.id == sid).values(max_turns=1)
    )
    await db_session.commit()

    await auth_client.post(f"{BASE}/{sid}/turn", json={"answer": "done"})

    r3 = await auth_client.post(f"{BASE}/{sid}/turn", json={"answer": "too late"})
    assert r3.status_code == 400
