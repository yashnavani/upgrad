"""Binds pipeline_root + feature_pipeline on request.state and contextvars."""

from __future__ import annotations

from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.pipeline import (
    feature_pipeline_var,
    infer_feature_pipeline,
    normalize_feature_slug,
    normalize_pipeline_root,
    pipeline_root_var,
)


class PipelineContextMiddleware(BaseHTTPMiddleware):
    """
    Single spine: pipeline_root (X-Pipeline-Root or X-Request-ID).
    Feature lane: X-Feature-Pipeline or inferred from path.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        rid = getattr(request.state, "request_id", None) or ""
        if not rid:
            rid = "unknown"

        root = normalize_pipeline_root(
            request.headers.get("X-Pipeline-Root"),
            rid,
        )
        feat = normalize_feature_slug(request.headers.get("X-Feature-Pipeline"))
        if not feat:
            feat = infer_feature_pipeline(request.url.path)

        request.state.pipeline_root_id = root
        request.state.feature_pipeline = feat

        tok_r = pipeline_root_var.set(root)
        tok_f = feature_pipeline_var.set(feat)
        try:
            response = await call_next(request)
            response.headers["X-Pipeline-Root"] = root
            response.headers["X-Feature-Pipeline"] = feat
            return response
        finally:
            pipeline_root_var.reset(tok_r)
            feature_pipeline_var.reset(tok_f)
