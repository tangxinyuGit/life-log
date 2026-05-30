import pytest


async def test_stats_summary_invalid_date_range(client, setup_db):
    resp = await client.get("/api/v1/stats/summary", params={
        "start_date": "2026-06-07",
        "end_date": "2026-06-01",
    })
    assert resp.status_code == 422
    assert "start_date" in resp.json()["detail"]


async def test_stats_summary_empty_with_zero_days(client, setup_db):
    """Empty range should still fill by_day with zeroes for each date."""
    resp = await client.get("/api/v1/stats/summary", params={
        "start_date": "2026-06-01",
        "end_date": "2026-06-03",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_hours"] == 0.0
    assert data["active_days"] == 0
    assert len(data["by_day"]) == 3
    assert data["by_day"][0]["date"] == "2026-06-01"
    assert data["by_day"][0]["hours"] == 0.0
    assert data["by_day"][2]["date"] == "2026-06-03"


async def test_stats_summary_empty(client, setup_db):
    resp = await client.get("/api/v1/stats/summary", params={
        "start_date": "2026-06-01",
        "end_date": "2026-06-07",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_hours"] == 0.0
    assert data["total_entries"] == 0
    assert data["active_days"] == 0
    assert len(data["by_day"]) == 7  # zero-filled for each date
    assert data["by_category"] == []


async def test_stats_summary_by_day(client, setup_db):
    cid = setup_db["first_category_id"]
    await client.post("/api/v1/entries", json={
        "title": "day1-morning",
        "start_time": "2026-06-01T09:00:00",
        "end_time": "2026-06-01T10:00:00",
        "category_id": cid, "tags": [],
    })
    await client.post("/api/v1/entries", json={
        "title": "day1-afternoon",
        "start_time": "2026-06-01T14:00:00",
        "end_time": "2026-06-01T16:00:00",
        "category_id": cid, "tags": [],
    })
    await client.post("/api/v1/entries", json={
        "title": "day2",
        "start_time": "2026-06-02T10:00:00",
        "end_time": "2026-06-02T11:00:00",
        "category_id": cid, "tags": [],
    })

    resp = await client.get("/api/v1/stats/summary", params={
        "start_date": "2026-06-01",
        "end_date": "2026-06-02",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_hours"] == 4.0  # 1+2+1
    assert data["total_entries"] == 3
    assert data["active_days"] == 2
    assert data["avg_hours_per_active_day"] == 2.0
    assert len(data["by_day"]) == 2  # 2026-06-01, 2026-06-02
    assert data["by_day"][0]["date"] == "2026-06-01"
    assert data["by_day"][0]["hours"] == 3.0
    assert data["by_day"][1]["date"] == "2026-06-02"
    assert data["by_day"][1]["hours"] == 1.0


async def test_stats_summary_by_category(client, setup_db):
    cid1 = setup_db["first_category_id"]
    # Fetch categories and find "运动" by name instead of fragile ID math
    cats_resp = await client.get("/api/v1/categories")
    cats = cats_resp.json()
    sport_cat = next(c for c in cats if c["name"] == "运动")
    cid2 = sport_cat["id"]

    await client.post("/api/v1/entries", json={
        "title": "work",
        "start_time": "2026-06-01T09:00:00",
        "end_time": "2026-06-01T12:00:00",
        "category_id": cid1, "tags": [],
    })
    await client.post("/api/v1/entries", json={
        "title": "sport",
        "start_time": "2026-06-01T17:00:00",
        "end_time": "2026-06-01T18:00:00",
        "category_id": cid2, "tags": [],
    })

    resp = await client.get("/api/v1/stats/summary", params={
        "start_date": "2026-06-01",
        "end_date": "2026-06-01",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["by_category"]) == 2
    cats = {c["name"]: c for c in data["by_category"]}
    assert cats["工作"]["hours"] == 3.0
    assert cats["工作"]["percentage"] == 75.0
    assert cats["运动"]["hours"] == 1.0
    assert cats["运动"]["percentage"] == 25.0


async def test_stats_summary_uncategorized(client, setup_db):
    await client.post("/api/v1/entries", json={
        "title": "misc",
        "start_time": "2026-06-01T10:00:00",
        "end_time": "2026-06-01T11:00:00",
        "tags": [],
    })
    resp = await client.get("/api/v1/stats/summary", params={
        "start_date": "2026-06-01",
        "end_date": "2026-06-01",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["by_category"]) == 1
    assert data["by_category"][0]["name"] == "未分类"
    assert data["by_category"][0]["color"] == "#6b7280"


async def test_stats_summary_mood_energy(client, setup_db):
    cid = setup_db["first_category_id"]
    await client.post("/api/v1/entries", json={
        "title": "e1",
        "start_time": "2026-06-01T09:00:00",
        "end_time": "2026-06-01T10:00:00",
        "category_id": cid, "tags": [],
        "mood": 3, "energy": 4,
    })
    await client.post("/api/v1/entries", json={
        "title": "e2",
        "start_time": "2026-06-01T11:00:00",
        "end_time": "2026-06-01T12:00:00",
        "category_id": cid, "tags": [],
        "mood": 5,
    })

    resp = await client.get("/api/v1/stats/summary", params={
        "start_date": "2026-06-01",
        "end_date": "2026-06-01",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["mood"]["average"] == 4.0
    assert data["mood"]["count"] == 2
    assert data["energy"]["average"] == 4.0
    assert data["energy"]["count"] == 1
