# Repo-root Dockerfile for Google Cloud Build / Cloud Run when the build uses
# workspace root (expects /workspace/Dockerfile). Same layout as backend/Dockerfile
# with paths prefixed by backend/.
FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_HTTP_TIMEOUT=600
COPY backend/requirements.txt requirements.txt
RUN uv pip install --system --no-cache -r requirements.txt

FROM python:3.12-slim

WORKDIR /app
ENV PYTHONPATH=/app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY backend/pyproject.toml backend/gunicorn_conf.py backend/alembic.ini ./
COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/create_admin.py ./

RUN useradd -m -u 10001 mf-user \
    && chown -R mf-user:mf-user /app

USER mf-user

EXPOSE 8000

CMD ["gunicorn", "-c", "gunicorn_conf.py", "app.main:app"]
