# backend/Dockerfile
# Build only from this directory:  docker build -t mf-backend .
FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install deps from requirements.txt only — do not `uv pip install .` (that triggers
# Hatchling/pep517 and extra PyPI fetches that often time out in Docker builds).
ENV UV_HTTP_TIMEOUT=600
COPY requirements.txt .
RUN uv pip install --system --no-cache -r requirements.txt

FROM python:3.12-slim

WORKDIR /app
# Console scripts (e.g. procrastinate) put /usr/local/bin on sys.path[0], not /app — imports of `app.*` fail without this.
ENV PYTHONPATH=/app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY pyproject.toml gunicorn_conf.py alembic.ini ./
COPY app ./app
COPY alembic ./alembic
COPY create_admin.py ./

RUN useradd -m -u 10001 mf-user \
    && chown -R mf-user:mf-user /app

USER mf-user

EXPOSE 8000

CMD ["gunicorn", "-c", "gunicorn_conf.py", "app.main:app"]
