"""
Tests for middleware functionality.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_request_id_middleware(client: AsyncClient):
    """Test that request ID is added to response headers."""
    response = await client.get("/api/v1/health")
    assert "X-Request-ID" in response.headers
    assert len(response.headers["X-Request-ID"]) > 0


@pytest.mark.asyncio
async def test_custom_request_id(client: AsyncClient):
    """Test that custom request ID is preserved."""
    custom_id = "test-request-id-123"
    response = await client.get(
        "/api/v1/health", headers={"X-Request-ID": custom_id}
    )
    assert response.headers["X-Request-ID"] == custom_id


@pytest.mark.asyncio
async def test_performance_middleware(client: AsyncClient):
    """Test that process time is added to response headers."""
    response = await client.get("/api/v1/health")
    assert "X-Process-Time" in response.headers
    assert response.headers["X-Process-Time"].endswith("ms")


@pytest.mark.asyncio
async def test_security_headers(client: AsyncClient):
    """Test that security headers are added."""
    response = await client.get("/api/v1/health")
    assert "X-Content-Type-Options" in response.headers
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "X-Frame-Options" in response.headers
    assert response.headers["X-Frame-Options"] == "DENY"
