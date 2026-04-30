# backend/tests/test_items.py
"""
Tests for the /api/v1/items CRUD blueprint.
Verifies the full lifecycle: create → list → get → update → delete.
"""
import pytest
from httpx import AsyncClient

BASE = "/api/v1/items"


# ── Create ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_item(auth_client: AsyncClient):
    response = await auth_client.post(BASE, json={"title": "My Item", "description": "Some desc"})
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["title"] == "My Item"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_item_no_db_actor(client: AsyncClient):
    response = await client.post(BASE, json={"title": "Sneaky"})
    assert response.status_code == 503


@pytest.mark.asyncio
async def test_create_item_missing_title(auth_client: AsyncClient):
    response = await auth_client.post(BASE, json={"description": "No title"})
    assert response.status_code == 422


# ── List ──────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_items_paginated(auth_client: AsyncClient):
    # Seed two items
    for title in ("Alpha", "Beta"):
        await auth_client.post(BASE, json={"title": title})

    response = await auth_client.get(BASE, params={"page": 1, "page_size": 10})
    assert response.status_code == 200, response.text
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "pages" in data
    assert data["page"] == 1


# ── Get single ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_item(auth_client: AsyncClient):
    created = (await auth_client.post(BASE, json={"title": "Fetchable"})).json()
    item_id = created["id"]

    response = await auth_client.get(f"{BASE}/{item_id}")
    assert response.status_code == 200
    assert response.json()["id"] == item_id


@pytest.mark.asyncio
async def test_get_nonexistent_item(auth_client: AsyncClient):
    response = await auth_client.get(f"{BASE}/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


# ── Update ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_item(auth_client: AsyncClient):
    created = (await auth_client.post(BASE, json={"title": "Original"})).json()
    item_id = created["id"]

    response = await auth_client.patch(f"{BASE}/{item_id}", json={"title": "Updated", "status": "done"})
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated"
    assert data["status"] == "done"


@pytest.mark.asyncio
async def test_update_item_not_owner(auth_client: AsyncClient, superuser_client: AsyncClient):
    # Superuser creates an item
    created = (await superuser_client.post(BASE, json={"title": "Admin Item"})).json()
    item_id = created["id"]

    # Regular user tries to update it
    response = await auth_client.patch(f"{BASE}/{item_id}", json={"title": "Hijacked"})
    assert response.status_code in (403, 404)


# ── Delete (soft) ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_soft_delete_item(auth_client: AsyncClient):
    created = (await auth_client.post(BASE, json={"title": "Delete Me"})).json()
    item_id = created["id"]

    delete_response = await auth_client.delete(f"{BASE}/{item_id}")
    assert delete_response.status_code == 204

    # Should no longer appear in GET
    get_response = await auth_client.get(f"{BASE}/{item_id}")
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_delete_item_not_owner(auth_client: AsyncClient, superuser_client: AsyncClient):
    created = (await superuser_client.post(BASE, json={"title": "Protected"})).json()
    item_id = created["id"]

    response = await auth_client.delete(f"{BASE}/{item_id}")
    assert response.status_code in (403, 404)


# ── Hard-delete (superuser only) ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_hard_delete_requires_superuser(auth_client: AsyncClient, superuser_client: AsyncClient):
    created = (await superuser_client.post(BASE, json={"title": "Permanent Target"})).json()
    item_id = created["id"]

    # Regular user should be denied
    deny_response = await auth_client.delete(f"{BASE}/{item_id}/permanent")
    assert deny_response.status_code == 403

    # Superuser should succeed
    ok_response = await superuser_client.delete(f"{BASE}/{item_id}/permanent")
    assert ok_response.status_code == 204
