"""Single correlation spine + per-feature pipeline slugs for logs and audit."""

from __future__ import annotations

import re
from contextvars import ContextVar

# Set per request in PipelineContextMiddleware; read in handlers / formatters.
pipeline_root_var: ContextVar[str | None] = ContextVar("pipeline_root", default=None)
feature_pipeline_var: ContextVar[str | None] = ContextVar("feature_pipeline", default=None)

_SLUG = re.compile(r"^[a-z0-9][a-z0-9_-]{0,62}$")


def normalize_pipeline_root(header: str | None, fallback_request_id: str) -> str:
    """Client sends X-Pipeline-Root to tie many HTTP calls to one workflow; else use request id."""
    if not header:
        return fallback_request_id
    h = header.strip().lower()
    if len(h) > 64 or not _SLUG.match(h):
        return fallback_request_id
    return h


def normalize_feature_slug(header: str | None) -> str | None:
    if not header:
        return None
    h = header.strip().lower()
    if len(h) > 64 or not _SLUG.match(h):
        return None
    return h


def infer_feature_pipeline(path: str) -> str:
    """First URL segment under /api/v1 → stable feature bucket for debugging."""
    p = path.split("?", 1)[0]
    prefix = "/api/v1"
    if not p.startswith(prefix):
        return "other"
    rest = p[len(prefix) :].strip("/")
    if not rest:
        return "root"
    first = rest.split("/")[0]
    if not first:
        return "root"
    seg = re.sub(r"[^a-z0-9_-]+", "_", first.lower()).strip("_")[:63]
    return seg or "root"
