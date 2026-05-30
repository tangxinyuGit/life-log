import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


# ---- CREATE ----

async def test_create_entry_success(client):
    resp = await client.post("/api/v1/entries", json={
        "title": "写代码",
        "start_time": "2026-05-30T10:00:00",
        "end_time": "2026-05-30T11:00:00",
        "category_id": 1,
        "tags": ["编程", "Python"],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "写代码"
    assert data["category"]["id"] == 1
    assert len(data["tags"]) == 2


async def test_create_entry_no_category(client):
    resp = await client.post("/api/v1/entries", json={
        "title": "休息",
        "start_time": "2026-05-30T12:00:00",
        "end_time": "2026-05-30T12:30:00",
        "tags": [],
    })
    assert resp.status_code == 201
    assert resp.json()["category_id"] is None
    assert resp.json()["category"] is None


async def test_create_entry_tags_dedup(client):
    resp = await client.post("/api/v1/entries", json={
        "title": "test",
        "start_time": "2026-05-30T14:00:00",
        "end_time": "2026-05-30T15:00:00",
        "category_id": 1,
        "tags": ["aaa", "AAA", "  ", "aaa"],
    })
    assert resp.status_code == 201
    tag_names = [t["name"] for t in resp.json()["tags"]]
    # Only "aaa" (first one) — case-insensitive dedup, empties stripped
    assert len(tag_names) == 1
    assert tag_names[0] == "aaa"


# ---- TIME VALIDATION ----

async def test_create_entry_invalid_time(client):
    resp = await client.post("/api/v1/entries", json={
        "title": "bad",
        "start_time": "2026-05-30T12:00:00",
        "end_time": "2026-05-30T11:00:00",
        "category_id": 1,
        "tags": [],
    })
    assert resp.status_code == 422
    assert "after start_time" in resp.json()["detail"]


# ---- CATEGORY ID VALIDATION ----

async def test_create_entry_invalid_category(client):
    resp = await client.post("/api/v1/entries", json={
        "title": "bad",
        "start_time": "2026-05-30T10:00:00",
        "end_time": "2026-05-30T11:00:00",
        "category_id": 99999,
        "tags": [],
    })
    assert resp.status_code == 422
    assert "not found" in resp.json()["detail"]


# ---- DATE FILTERING ----

async def test_list_entries_date_filter(client):
    resp = await client.get("/api/v1/entries", params={"date": "2026-05-30", "page_size": 100})
    assert resp.status_code == 200
    data = resp.json()
    for item in data["items"]:
        assert item["start_time"].startswith("2026-05-30")


async def test_list_entries_keyword_search(client):
    resp = await client.get("/api/v1/entries", params={"keyword": "写代码", "page_size": 100})
    assert resp.status_code == 200
    items = resp.json()["items"]
    # At least the one we created above
    assert any("写代码" in item["title"] for item in items)


# ---- CATEGORIES ----

async def test_categories_list(client):
    resp = await client.get("/api/v1/categories")
    assert resp.status_code == 200
    cats = resp.json()
    assert len(cats) >= 7  # default seeds


async def test_categories_name_conflict(client):
    resp = await client.post("/api/v1/categories", json={
        "name": "工作",
        "color": "#000000",
    })
    assert resp.status_code == 409


# ---- 404 ----

async def test_get_entry_not_found(client):
    resp = await client.get("/api/v1/entries/99999")
    assert resp.status_code == 404


async def test_delete_entry_not_found(client):
    resp = await client.delete("/api/v1/entries/99999")
    assert resp.status_code == 404
