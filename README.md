# AI Mock Interview Coach

Multi-agent mock interview system: adaptive questions (Gemini + PydanticAI), multi-axis scoring, structured coaching, **optional HeyGen LiveAvatar**, and a **voice-only** mode (Gemini native TTS, no video / no HeyGen).

---

## Setup and run instructions

### Prerequisites

- Docker + Docker Compose
- A **Google AI (Gemini) API key** for interviewer, evaluator, coach, and voice TTS
- Optional: HeyGen LiveAvatar credentials for the **video avatar** interview only (`/interview`)

### 1. Configure environment

From the **repository root**:

```bash
cp env.example .env
```

Edit `.env` and set at minimum:

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Required for all LLM agents + Gemini TTS (voice interview) |
| `POSTGRES_*` | Database; defaults match `docker-compose.yml` unless you change them |

Optional:

- **HeyGen (avatar interview only):** `LIVEAVATAR_API_KEY`, `LIVEAVATAR_AVATAR_ID`, and for studio voice `LIVEAVATAR_SESSION_MODE=FULL`, `LIVEAVATAR_VOICE_ID` — see comments in `env.example`.
- **Voice TTS tuning:** `GEMINI_TTS_MODEL`, `GEMINI_TTS_VOICE` (defaults work for `POST /interviews/voice-tts`).
- **Production:** `SYSTEM_ACTOR_USER_ID` set to the UUID of the bootstrap user (see below).

### 2. Start services

```bash
docker compose up -d --build
```

### 3. Database migrations

```bash
make migrate-up
```

Or:

```bash
docker compose exec backend alembic upgrade head
```

### 4. Create the system user (required for API)

The POC uses a single **system actor** user for authenticated routes (no separate login UI in this flow):

```bash
docker compose exec backend python create_admin.py admin@example.com admin123 "Admin User"
```

In **production**, set `SYSTEM_ACTOR_USER_ID` in `.env` to that user’s UUID.

### 5. Open the app

| URL | What |
|-----|------|
| http://localhost:3001 | Next.js UI (port overridable via `FRONTEND_HOST_PORT`) |
| http://localhost:8000/api/v1 | FastAPI |

**Interview entry points:**

- **Mock interview (optional HeyGen video):** `/interview`
- **Voice-only (Gemini TTS, no camera / no HeyGen):** `/interview/voice`

### Local development (without Docker for frontend only)

```bash
cd frontend && npm ci && npm run dev
```

Backend still expects Postgres and env vars; Compose is the supported path for a full stack.

### Python dependencies (assignment / `pip`)

Backend dependencies are declared in `backend/pyproject.toml` (Hatch). For a classic **`pip install -r requirements.txt`** workflow, use the generated **`requirements.txt`** at the repo root (same pins as the project dependencies list).

---

## Architecture overview

### What each agent does

Prompts live in **`backend/app/prompts/`** (one file per role):

| Agent | File | Role |
|--------|------|------|
| **Interviewer** | `interviewer.md` | Conducts the live Q&A: one question per turn, adapts to the candidate’s last answer (probe weak answers, advance after strong ones, graceful pivot on “I don’t know”). No numeric scoring in-character. |
| **Evaluator** | `evaluator.md` | Runs **once** after the final candidate answer. Outputs **structured JSON** (Pydantic): four independent 1–10 scores with short evidence-based notes (communication, technical accuracy, problem solving, behavioral fit). |
| **Coach** | `coach.md` | Runs **after** the evaluator. Consumes transcript + evaluator JSON and outputs **Markdown** with fixed sections: overall impression, strengths, gaps, three concrete practice drills, score recap. |

### How they are orchestrated

Orchestration is **explicit and deterministic** (not a hidden multi-agent graph):

1. **`POST /api/v1/interviews`** — Creates `InterviewSession`, persists metadata (role, focus, resume snippet, `max_turns`), calls **`generate_interview_turn`** once to append the **opening model question** to the transcript.
2. **`POST /api/v1/interviews/{id}/turn`** — Appends the user’s answer, increments `turn_count`. If below `max_turns`, calls **`generate_interview_turn`** again with full transcript history for the **next** question. If `turn_count` reaches `max_turns`, calls **`evaluate_and_coach`** (evaluator agent → coach agent), stores `feedback_data`, marks session `completed`.
3. **Runtime pacing hints** — `backend/app/services/interview_agents.py` injects per-turn instructions (e.g. how many answers remain) so the interviewer model paces and adapts across rounds.

**Voice vs avatar (frontend only):** same REST API and transcript model. **Voice mode** calls **`POST /api/v1/interviews/voice-tts`** (Gemini native audio → WAV) to read questions aloud. **Avatar mode** mints HeyGen LiveAvatar tokens and uses the web SDK (no voice TTS path on the server for questions).

Code entrypoints:

- Agents + orchestration glue: `backend/app/services/interview_agents.py`
- HTTP routes: `backend/app/api/v1/endpoints/interviews.py`
- Gemini client singleton: `backend/app/core/gemini_clients.py`
- Voice TTS: `backend/app/services/gemini_tts.py`

---

## Key design decisions and tradeoffs

| Decision | Rationale | Tradeoff |
|----------|-----------|----------|
| **Three separate agents** | Interviewer stays “in scene”; evaluator stays cold and structured; coach stays supportive. Avoids one model mixing empathy with hard scores. | Linear pipeline only (no debate / router agent). Sufficient for POC scope. |
| **PydanticAI + Gemini Flash** | Typed evaluator output, one integration surface, fast enough for interactive turns. | Single model family; heavy prompts needed for edge cases. |
| **Evaluator then coach (serial)** | Coach must not re-score; it reflects evaluator JSON to stay consistent. | Extra latency on final turn vs one mega-prompt. |
| **Structured API orchestration** | Easy to test, log, and swap UI (CLI could call the same routes). | Less “magic” than an autonomous agent swarm. |
| **Voice TTS on server** | Keeps `GEMINI_API_KEY` off the browser for speech generation; returns WAV. | Extra network hop; browser fallback to `speechSynthesis` if TTS fails. |
| **HeyGen optional** | Full product demo when keys exist; text + voice paths still work without HeyGen. | LiveAvatar sandbox limits session duration; see voice interview for long sessions without video. |
| **System actor user** | Speeds POC; no auth UI in this branch. | Not suitable for multi-tenant production without real auth. |

---

## Example interview transcripts

Illustrative only (not from a live model run). Format: `MODEL:` / `USER:`.

### Example A — strong candidate (concise, evidence-led)

**Target role:** Backend Engineer Intern · **Focus:** technical

```
MODEL: Walk me through one system you built where reliability mattered. What did you monitor, and what broke in production if anything?

USER: I worked on a ticket resale service. We used Postgres with read replicas for search; primary for writes. I added health checks on connection pool saturation and p95 API latency in Grafana. Once a replica lagged past 30s—we’d alert on replication lag. In prod we had a spike when a bad query did a sequential scan; we caught it from slow-query logs, added a composite index on (event_id, status), and added a feature flag to disable the expensive sort path.

MODEL: Good. How did you decide between fixing the query versus throwing more hardware at it?

USER: We profiled EXPLAIN first—cost was dominated by the sort. More replicas wouldn’t fix a bad plan on the primary. Index + smaller default page size for that endpoint was cheaper and fixed p95 in one deploy.

MODEL: How would you design idempotency for a payment callback that might arrive twice?

USER: Store provider event_id unique; on duplicate insert return 200 and no-op. Use a DB transaction so ledger update and idempotency row commit together. Outbound retries use the same client request id header so the PSP can dedupe on their side too.
```

### Example B — weak candidate (vague, short)

**Target role:** Product Manager Intern · **Focus:** behavioral

```
MODEL: Tell me about a time you influenced a decision without authority.

USER: I usually just talk to people and they agree. I’m collaborative.

MODEL: Can you give one specific situation—who disagreed, what was at stake, and what you did next?

USER: There was a roadmap thing. I said we should prioritize onboarding. They listened.

MODEL: What metric or user signal did you use to argue for onboarding over the other item?

USER: It felt important. Everyone wants good onboarding.

MODEL: If you had to defend that to an exec in two minutes, what one number would you wish you had had ready?
```

### Example C — tricky / edge case (off-topic + partial recovery)

**Target role:** Data Analyst Intern · **Focus:** mixed

```
MODEL: How would you explain a sudden week-over-week drop in activation to a non-technical stakeholder?

USER: Honestly I spent most of last week fixing Excel crashes and a broken macro—our pipeline export kept corrupting dates. So I didn’t dig into activation yet.

MODEL: Understood. Separate from the Excel issue: if activation dropped 18% WoW but the funnel step “email verified” stayed flat, where would you look first?

USER: I’d check if the definition of activation changed—like a tracking bug—or if a new paywall shipped. I’d also slice by acquisition channel in case one campaign turned bad.

MODEL: Say tracking is clean and no product launch. Name two cohort views you’d compare to see if it’s a new-user quality problem versus returning users disengaging.

USER: I’d compare first-week retention for users acquired each week for the last eight weeks, and I’d segment mobile vs web in case a platform release broke the activation event on one side only.
```

---

## Useful commands

| Command | Purpose |
|---------|---------|
| `make migrate-up` | Alembic migrations in backend container |
| `make logs` | Tail Compose logs |
| `make lint` | Ruff (backend) + ESLint (frontend) |

---

## Repository

Upstream for submissions: [github.com/yashnavani/upgrad](https://github.com/yashnavani/upgrad)
