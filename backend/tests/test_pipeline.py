from app.core.pipeline import (
    infer_feature_pipeline,
    normalize_feature_slug,
    normalize_pipeline_root,
)


def test_infer_feature_pipeline():
    assert infer_feature_pipeline("/api/v1/dashboard/metrics") == "dashboard"
    assert infer_feature_pipeline("/api/v1/ai/chat") == "ai"
    assert infer_feature_pipeline("/api/v1/decisions/pending") == "decisions"
    assert infer_feature_pipeline("/other") == "other"


def test_normalize_pipeline_root():
    rid = "550e8400-e29b-41d4-a716-446655440000"
    assert normalize_pipeline_root(None, rid) == rid
    assert normalize_pipeline_root("bad slug!", rid) == rid
    assert normalize_pipeline_root("my-workflow-1", rid) == "my-workflow-1"


def test_normalize_feature_slug():
    assert normalize_feature_slug("insights") == "insights"
    assert normalize_feature_slug("BAD") == "bad"
    assert normalize_feature_slug("no spaces") is None
