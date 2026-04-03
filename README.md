# Master Foundation — Command Centre Template

This repository is a full-stack **AI-native application template**: a **Next.js 16** frontend with **Auth.js (NextAuth v5)** credentials sign-in, a **FastAPI** backend with **native JWT** issuance (Argon2 password hashes), **async SQLAlchemy** and **PostgreSQL**, optional **PydanticAI + Gemini** tooling, **request audit telemetry**, and **Docker Compose** for local and deployment-style runs.

Use it as a starting point for each new “command centre” you build: copy the repo, fill in `env.example`-style secrets, run migrations, and extend routes and UI.

---

## Table of contents

1. [What’s in the box](#whats-in-the-box)
2. [Repository layout](#repository-layout)
3. [Architecture (end-to-end)](#architecture-end-to-end)
4. [Prerequisites](#prerequisites)
5. [Environment variables](#environment-variables)
6. [Quick start (Docker)](#quick-start-docker)
7. [Makefile commands](#makefile-commands)
8. [Database migrations (Alembic)](#database-migrations-alembic)
9. [Local development (without Docker)](#local-development-without-docker)
10. [AI digest for LLM context](#ai-digest-for-llm-context)
11. [Important changes and decisions](#important-changes-and-decisions)
12. [Troubleshooting](#troubleshooting)
13. [Security notes](#security-notes)

---

## What’s in the box

| Layer | Technology | Role |
|--------|------------|------|
| **Frontend** | Next.js 16, React 19, Tailwind v4 | App shell, login, command palette, AI chat panel, protected routes |
| **Auth** | Auth.js (NextAuth v5), Credentials → FastAPI `/auth/login` | Register/login; access JWT sent to API as `Authorization: Bearer` |
| **API** | FastAPI, Gunicorn + Uvicorn workers | REST under `/api/v1`, JWT verification with shared **`AUTH_SECRET`** / **`JWT_SECRET`** |
| **Database** | PostgreSQL 15 (Docker) | App data: **`User`** with **`hashed_password`**, audit logs |
| **ORM / migrations** | SQLAlchemy 2 async, Alembic | Schema versioning |
| **AI** | PydanticAI, Gemini | `/api/v1/ai/chat` with tools and structured responses |
| **Observability** | Middleware + `AuditLog` | Per-request timing, status, optional `actor_id` |

---

## Repository layout

Everything lives at the **project root** (e.g. `c:\template` or your clone path). There is **no** nested `master-foundation` folder in the intended layout.

```
.
├── backend/                 # FastAPI app, Alembic, Dockerfile (build context = this folder only)
│   ├── app/
│   ├── alembic/
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/                # Next.js app, Dockerfile (build context = this folder only)
│   ├── src/
│   ├── public/
│   ├── .env.local           # Optional: local Next dev (not committed)
│   └── Dockerfile
├── docker-compose.yml       # Postgres + backend + frontend
├── Makefile                 # Compose shortcuts + digest
├── make_digest.py           # Generates digest.txt for LLM context
├── env.example              # Template for all env keys (empty values)
├── .env                     # Secrets + Compose vars (not committed); single source for API + Compose
└── README.md                # This file
```

**Docker build contexts** are intentionally **only** `./backend` and `./frontend` so images do not depend on a parent directory.

---

## Architecture (end-to-end)

### Request flow (authenticated UI → API)

1. User registers or signs in on **`/login`**; credentials are posted to **`POST /api/v1/auth/login`** (OAuth2 password form) and **`POST /api/v1/auth/register`** (JSON).
2. **Auth.js** stores the API access token in the session; middleware protects routes and redirects unauthenticated users to **`/login`** (allows **`/api/auth/*`**).
3. The browser client calls **`apiClient`** (`frontend/src/lib/api-client.ts`), which attaches **`Authorization: Bearer <access_token>`** to requests to **`NEXT_PUBLIC_API_URL`** (default `http://localhost:8000/api/v1`).
4. FastAPI **`get_current_user`** verifies the JWT with the same signing secret as the API (**`AUTH_SECRET`** or **`JWT_SECRET`**, alias **`SUPABASE_JWT_SECRET`** for older env files), audience **`authenticated`**, then loads **`User`** by JWT **`sub`** (user id).
5. **`TelemetryMiddleware`** records each request to **`AuditLog`** after the response; if `request.state.user` was set by the dependency, **`actor_id`** is stored.

### Services (Docker Compose)

| Service | Container name | Host ports | Notes |
|---------|----------------|------------|--------|
| **database** | `mf-postgres` | **`5433` → 5432** (default) | Host port is configurable; see [Troubleshooting](#troubleshooting) |
| **backend** | `mf-backend` | `8000` | Overrides `POSTGRES_SERVER=database` inside the stack |
| **frontend** | `mf-frontend` | **`3001` → 3000** (default) | Build/runtime: **`AUTH_SECRET`**, **`AUTH_URL`**, **`NEXT_PUBLIC_API_URL`**, optional **`INTERNAL_API_URL`**; override host port with **`FRONTEND_HOST_PORT`** |

Internal API base URL from the browser is usually **`http://localhost:8000/api/v1`** when everything runs on the same machine.

### Key API routes

- **`GET /health`** — Liveness (no auth).
- **`POST /api/v1/auth/register`**, **`POST /api/v1/auth/login`** — Native sign-up and OAuth2 password login (returns Bearer token).
- **`GET /api/v1/users/me`** — Current user profile (Bearer JWT).
- **`GET /api/v1/users/admin-only`** — Example superuser-only route.
- **`POST /api/v1/ai/chat`** — AI chat (Bearer JWT); returns reply + `tools_used` audit trail.

---

## Prerequisites

- **Docker Desktop** (or Docker Engine) with **Docker Compose V2** (`docker compose`).
- **Make** (optional but recommended): GNU Make on Linux/macOS, or Git Bash on Windows.
- **Python 3.12+** (optional): for `make_digest.py` / local backend without Docker.
- **Node 20+** (optional): for `next dev` without Docker.
- A strong **`AUTH_SECRET`** (and matching backend JWT signing key) in repo-root **`.env`**.
- A **Google AI (Gemini) API key** if you use `/ai/chat`.

---

## Environment variables

**Template file:** `env.example` — same keys as production, **empty values**.

### Single repo-root `.env` (required for Docker + backend)

Use **one** file: **`.env` next to `docker-compose.yml`**.

- **Docker Compose** loads it for variable substitution (`NEXT_PUBLIC_*` for the frontend build/run) and passes it into the **backend** container via **`env_file: ./.env`**.
- **FastAPI** loads the same path from `backend/app/core/config.py` (resolved to the parent of the `backend/` folder), so **local Uvicorn** and **Alembic** see the same values regardless of your shell’s current directory.

Include:

- **`AUTH_SECRET`**, **`NEXT_PUBLIC_API_URL`**, optional **`INTERNAL_API_URL`** (Docker: e.g. `http://backend:8000/api/v1` for server-side NextAuth login).
- **`POSTGRES_*`**, **`JWT_SECRET`** / **`ACCESS_TOKEN_EXPIRE_MINUTES`**, **`GEMINI_API_KEY`**, etc. — see `env.example`.  
  In Docker, Compose sets **`POSTGRES_SERVER=database`**, **`POSTGRES_PORT=5432`**, and pins **`postgres` / `postgres_password` / `master_foundation`** on both **`database`** and **`backend`** so `.env` cannot desync them (use the same values from **`env.example`** when connecting from the host on port **5433**).

Optional for Postgres host port clash:

- **`POSTGRES_HOST_PORT`** (default **`5433`** in `docker-compose.yml`)

### `frontend/.env.local` (optional, local `next dev` only)

Set **`AUTH_SECRET`**, **`AUTH_URL`** (e.g. `http://localhost:3001`), and **`NEXT_PUBLIC_API_URL`** if you run Next outside Docker.

**Never commit** real `.env` or `frontend/.env.local`.

---

## Quick start (Docker)

From the **project root**:

```bash
# 1. Copy env template and fill values
cp env.example .env
# Edit repo-root .env (AUTH_SECRET + NEXT_PUBLIC_API_URL + database + Gemini).

# 2. Build and start
docker compose up --build -d

# 3. Apply migrations (first time and after new revisions)
docker compose exec backend alembic upgrade head
```

Then open:

- **App:** http://localhost:3001 (default host port; set **`FRONTEND_HOST_PORT`** to change)  
- **API docs:** http://localhost:8000/docs  
- **Health:** http://localhost:8000/health  

**Postgres from your host** (e.g. GUI client): `localhost` port **`5433`** (unless you set `POSTGRES_HOST_PORT`).

---

## Makefile commands

Run from project root (`make` may be `mingw32-make` or unavailable on some Windows shells; the commands below are equivalent without Make):

| Target | Effect |
|--------|--------|
| `make up` | `docker compose up -d` |
| `make down` | `docker compose down` |
| `make build` | `docker compose build` |
| `make logs` | `docker compose logs -f` |
| `make migrate-up` | `docker compose exec backend alembic upgrade head` |
| `make migrate-create MSG="..."` | Autogenerate Alembic revision |
| `make reset-db` | `docker compose down -v` then `up -d` (destructive) |
| `make digest` / `make ingest` | Run `make_digest.py` → `digest.txt` |

Override Python on Windows if needed: `make digest PYTHON=python`.

---

## Database migrations (Alembic)

- Config: `backend/alembic.ini`, async env in `backend/alembic/env.py`.
- **Inside running backend container:**

```bash
docker compose exec backend alembic upgrade head
docker compose exec backend alembic revision --autogenerate -m "describe change"
```

Or use **`make migrate-up`** / **`make migrate-create MSG="..."`**.

---

## Local development (without Docker)

**Backend:** create a venv, install from `backend/pyproject.toml`, keep **`POSTGRES_*`** in the **repo-root** `.env` pointing at your DB (`POSTGRES_SERVER=localhost` and the host-mapped port, e.g. **5433**, if you use only the Compose database from the host). Run Uvicorn from `backend/` pointing at `app.main:app` — settings still read **`../.env`** via an absolute path.

**Frontend:** `cd frontend && npm install && npm run dev` with `frontend/.env.local` set.

Ensure CORS in `backend/app/main.py` includes your dev origin (defaults include **`http://localhost:3001`** and **3000**).

---

## AI digest for LLM context

```bash
python make_digest.py
# or
make digest
```

Produces **`digest.txt`**: a tree of the repo plus selected source files, excluding secrets, `node_modules`, `.next`, venvs, etc. Use it to paste project context into Cursor or other LLMs. **`digest.txt`** should not be committed if it might contain sensitive data.

---

## Important changes and decisions

### Flat repository layout

The project used to live under a nested folder **`master-foundation/`**. It was **flattened** so **`backend/`** and **`frontend/`** sit **directly under the repo root**, alongside `docker-compose.yml` and `Makefile`. This matches how Docker contexts and Compose paths are written today.

If you still see an empty **`master-foundation`** directory locally, it is safe to delete once no program has that path open (Windows file locks).

### Postgres host port (`5432` vs `5433`)

Many machines already run PostgreSQL on **5432**. The Compose file maps the container’s **5432** to host **`POSTGRES_HOST_PORT`**, defaulting to **`5433`**, so **`docker compose up` does not fail** with “port already allocated”. Containers still talk to the DB on **`database:5432`**.

### Native identity (no Supabase)

Passwords are hashed with **Argon2** in the API; JWTs are minted by FastAPI and carried in the NextAuth session. **`AUTH_SECRET`** must match the backend signing secret so cookies and API tokens stay consistent.

### Next.js middleware deprecation notice

Next 16 may log that the **`middleware`** file convention is deprecated in favour of **`proxy`**. This is a framework migration path for the future; the app currently uses **`src/middleware.ts`** for Auth.js session checks.

---

## Troubleshooting

| Symptom | Likely cause | What to do |
|---------|----------------|------------|
| `Bind for 0.0.0.0:5432 failed: port is already allocated` | Host Postgres or other service on 5432 | Already addressed: use default **5433** or set `POSTGRES_HOST_PORT` |
| Login buttons stuck spinning | Old bug: uncaught auth errors | Fixed: ensure latest `frontend` image / code; clear cache |
| Login fails from Docker frontend | NextAuth server cannot reach API on `localhost` | Set **`INTERNAL_API_URL=http://backend:8000/api/v1`** in **repo-root** `.env` (see `docker-compose.yml`). |
| API 401 from browser | No/expired session; wrong signing secret | Re-login; ensure **`AUTH_SECRET`** (NextAuth) matches backend **`JWT_SECRET`** / **`AUTH_SECRET`** / **`SUPABASE_JWT_SECRET`** alias. |
| CORS errors | Frontend origin not allowed | Add your origin to FastAPI `CORSMiddleware` |
| Backend cannot reach DB in Docker | Wrong `POSTGRES_*` in repo-root `.env` | User/password/DB must match the **`database`** service. Compose now passes the same **`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`** to both Postgres and the API. |
| `password authentication failed for user "postgres"` | `.env` password ≠ password Postgres was first created with | Set **`POSTGRES_PASSWORD`** in `.env` to the password your volume was initialized with (default **`postgres_password`** if you never changed it), or **`docker compose down -v`** then **`up`** to recreate the DB (destroys data). |

---

## Security notes

- **Rotate** any API key that was ever committed, pasted in chat, or shared.
- **Do not** paste production `.env` into LLM chats; use **`env.example`** as the contract for keys only.
- **`generate_token.py`** (if present in `backend/`) is for local debugging; exclude it from production images or digests if it can mint tokens.
- **`AUTH_SECRET`** and **`JWT_SECRET`** are server-only; never expose them in client bundles. Use a long random value in production.

---

## License and reuse

Treat this repo as an internal template: fork or copy per command centre, document your own product name in `PROJECT_NAME` and UI copy, and keep **`env.example`** updated when you add new configuration keys so the next project stays easy to bootstrap.
