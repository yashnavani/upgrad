# Makefile — run from the project root (this directory, e.g. c:\template).
# Uses `docker compose` (Docker Compose V2). Each image builds only from ./backend or ./frontend.

COMPOSE ?= docker compose

.PHONY: setup up down logs build migrate-create migrate-up reset-db digest ingest lint worker-setup worker-start

# Generate the project digest for AI context (run from project root).
PYTHON ?= python3
digest:
	$(PYTHON) make_digest.py

ingest: digest

# Lint backend (Ruff) and frontend (ESLint); run from project root
lint:
	$(PYTHON) -m ruff check backend
	cd frontend && npm run lint:ci

up:
	$(COMPOSE) up -d

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build

logs:
	$(COMPOSE) logs -f

migrate-create:
	$(COMPOSE) exec backend alembic revision --autogenerate -m "$(MSG)"

migrate-up:
	$(COMPOSE) exec backend alembic upgrade head

reset-db:
	$(COMPOSE) down -v
	$(COMPOSE) up -d

# Procrastinate: create queue tables in Postgres (run once per database).
worker-setup:
	cd backend && procrastinate --app=app.core.worker.app schema --apply

# Run the background worker (listens on queues such as ai_jobs).
worker-start:
	cd backend && procrastinate --app=app.core.worker.app worker
