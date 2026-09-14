from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from fastapi.testclient import TestClient

from app import api as api_module
from app.schemas import PatentHit
from tests.conftest import FakeAsyncConnection, FakeAsyncCursor, make_subscription_cursor


def _make_client(
    monkeypatch: pytest.MonkeyPatch,
    connection: FakeAsyncConnection,
    user: dict[str, str] | None = None,
) -> TestClient:
    async def _conn_dep() -> AsyncIterator[FakeAsyncConnection]:
        yield connection

    monkeypatch.setattr(api_module, "init_pool", lambda: None)
    api_module.app.dependency_overrides[api_module.get_conn] = _conn_dep
    if user is not None:
        api_module.app.dependency_overrides[api_module.get_current_user] = lambda: user
    return TestClient(api_module.app)


def _cleanup_client(client: TestClient) -> None:
    client.close()
    api_module.app.dependency_overrides.clear()


def test_post_search_keyword(monkeypatch: pytest.MonkeyPatch, fake_user: dict[str, str]) -> None:
    async def fake_search(conn, **kwargs):
        assert kwargs["sort_by"] == "pub_date_desc"
        return 1, [PatentHit(pub_id="US1", title="Result")]

    monkeypatch.setattr(api_module, "search_hybrid", fake_search)
    conn = FakeAsyncConnection([make_subscription_cursor()])
    client = _make_client(monkeypatch, conn, fake_user)

    try:
        resp = client.post("/search", json={"keywords": "ai"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["pub_id"] == "US1"
    finally:
        _cleanup_client(client)


def test_post_search_semantic_invokes_embed(monkeypatch: pytest.MonkeyPatch, fake_user: dict[str, str]) -> None:
    events: list[str] = []

    async def fake_embed(text: str):
        events.append(f"embed:{text}")
        return [0.1, 0.2]

    async def fake_search(conn, **kwargs):
        assert kwargs["query_vec"] == [0.1, 0.2]
        assert kwargs["sort_by"] == "pub_date_desc"
        return 1, [PatentHit(pub_id="US1", title="Semantic")]

    monkeypatch.setattr(api_module, "embed_text", fake_embed)
    monkeypatch.setattr(api_module, "search_hybrid", fake_search)
    client = _make_client(monkeypatch, FakeAsyncConnection([make_subscription_cursor()]), fake_user)

    try:
        resp = client.post("/search", json={"semantic_query": "robotics"})
        assert resp.status_code == 200
        assert events == ["embed:robotics"]
    finally:
        _cleanup_client(client)


def test_trend_volume_endpoint(monkeypatch: pytest.MonkeyPatch, fake_user: dict[str, str]) -> None:
    async def fake_trend(conn, **kwargs):
        assert kwargs["group_by"] == "month"
        return [("2024-01", 5, "Google LLC"), ("2024-02", 2, "Microsoft")]

    monkeypatch.setattr(api_module, "trend_volume", fake_trend)
    client = _make_client(monkeypatch, FakeAsyncConnection([make_subscription_cursor()]), fake_user)

    try:
        resp = client.get("/trend/volume", params={"group_by": "month"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["points"][0] == {"bucket": "2024-01", "count": 5, "top_assignee": "Google LLC"}
    finally:
        _cleanup_client(client)


def test_patent_detail_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_detail(conn, pub_id: str):
        return None

    monkeypatch.setattr(api_module, "get_patent_detail", fake_detail)
    conn = FakeAsyncConnection([])
    client = _make_client(monkeypatch, conn, None)

    try:
        resp = client.get("/patent/US404")
        assert resp.status_code == 404
    finally:
        _cleanup_client(client)


def test_patent_date_range(monkeypatch: pytest.MonkeyPatch) -> None:
    cursor = FakeAsyncCursor(fetchone=(20230101, 20240101))
    conn = FakeAsyncConnection([cursor])
    client = _make_client(monkeypatch, conn, None)

    try:
        resp = client.get("/patent-date-range")
        assert resp.status_code == 200
        assert resp.json() == {"min_date": 20230101, "max_date": 20240101}
    finally:
        _cleanup_client(client)


def test_export_csv(monkeypatch: pytest.MonkeyPatch, fake_user: dict[str, str]) -> None:
    async def fake_export(conn, **kwargs):
        assert kwargs["sort_by"] == "pub_date_desc"
        return [
            {
                "pub_id": "US1",
                "title": "First",
                "abstract": "Abstract",
                "assignee_name": "OpenAI",
                "pub_date": 20240101,
                "priority_date": 20230101,
                "cpc": "G06N",
            }
        ]

    monkeypatch.setattr(api_module, "export_rows", fake_export)
    client = _make_client(monkeypatch, FakeAsyncConnection([make_subscription_cursor()]), fake_user)

    try:
        resp = client.get("/export", params={"format": "csv"})
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/csv")
        body = resp.text
        assert "pub_id" in body.splitlines()[0]
        assert "US1" in body
    finally:
        _cleanup_client(client)


def test_list_saved_queries(monkeypatch: pytest.MonkeyPatch, fake_user: dict[str, str]) -> None:
    cursor = FakeAsyncCursor(
        fetchall=[
            {
                "id": "123",
                "owner_id": fake_user["sub"],
                "name": "Alerts",
                "filters": {"keywords": "ai"},
                "semantic_query": None,
                "schedule_cron": None,
                "is_active": True,
                "created_at": "2024-01-01",
                "updated_at": "2024-01-02",
            }
        ]
    )
    conn = FakeAsyncConnection([make_subscription_cursor(), cursor])
    client = _make_client(monkeypatch, conn, fake_user)

    try:
        resp = client.get("/saved-queries")
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"][0]["name"] == "Alerts"
    finally:
        _cleanup_client(client)


def test_create_saved_query(monkeypatch: pytest.MonkeyPatch, fake_user: dict[str, str]) -> None:
    user_cursor = FakeAsyncCursor()
    cursor = FakeAsyncCursor(fetchone=("new-id",))
    conn = FakeAsyncConnection([make_subscription_cursor(), user_cursor, cursor])
    client = _make_client(monkeypatch, conn, fake_user)

    try:
        payload = {"name": "Weekly", "filters": {"keywords": "ai"}}
        resp = client.post("/saved-queries", json=payload)
        assert resp.status_code == 200
        assert resp.json() == {"id": "new-id"}
        assert "INSERT INTO app_user" in user_cursor.last_sql
    finally:
        _cleanup_client(client)


def test_create_saved_query_requires_email(monkeypatch: pytest.MonkeyPatch) -> None:
    cursor = FakeAsyncCursor(fetchone=("new-id",))
    conn = FakeAsyncConnection([make_subscription_cursor(), cursor])
    client = _make_client(monkeypatch, conn, {"sub": "user-123"})

    try:
        payload = {"name": "Weekly", "filters": {"keywords": "ai"}}
        resp = client.post("/saved-queries", json=payload)
        assert resp.status_code == 400
        assert resp.json()["detail"] == "user missing email claim"
        # Ensure save query insert was never attempted
        assert cursor.last_sql is None
    finally:
        _cleanup_client(client)


def test_delete_saved_query(monkeypatch: pytest.MonkeyPatch, fake_user: dict[str, str]) -> None:
    cursor = FakeAsyncCursor(rowcount=1)
    conn = FakeAsyncConnection([make_subscription_cursor(), cursor])
    client = _make_client(monkeypatch, conn, fake_user)

    try:
        resp = client.delete("/saved-queries/123")
        assert resp.status_code == 200
        assert resp.json() == {"deleted": 1}
    finally:
        _cleanup_client(client)


def test_delete_saved_query_not_found(monkeypatch: pytest.MonkeyPatch, fake_user: dict[str, str]) -> None:
    cursor = FakeAsyncCursor(rowcount=0)
    conn = FakeAsyncConnection([make_subscription_cursor(), cursor])
    client = _make_client(monkeypatch, conn, fake_user)

    try:
        resp = client.delete("/saved-queries/999")
        assert resp.status_code == 404
    finally:
        _cleanup_client(client)


def test_update_saved_query(monkeypatch: pytest.MonkeyPatch, fake_user: dict[str, str]) -> None:
    cursor = FakeAsyncCursor(fetchone=("123",))
    conn = FakeAsyncConnection([make_subscription_cursor(), cursor])
    client = _make_client(monkeypatch, conn, fake_user)

    try:
        resp = client.patch("/saved-queries/123", json={"is_active": False})
        assert resp.status_code == 200
        assert resp.json() == {"id": "123", "is_active": False}
    finally:
        _cleanup_client(client)


def test_update_saved_query_requires_field(monkeypatch: pytest.MonkeyPatch, fake_user: dict[str, str]) -> None:
    client = _make_client(monkeypatch, FakeAsyncConnection([make_subscription_cursor()]), fake_user)

    try:
        resp = client.patch("/saved-queries/123", json={})
        assert resp.status_code == 400
    finally:
        _cleanup_client(client)


def test_scope_analysis_embeds_whitespace_collapsed_text(
    monkeypatch: pytest.MonkeyPatch, fake_user: dict[str, str]
) -> None:
    embedded: list[str] = []

    async def fake_embed(text: str):
        embedded.append(text)
        return [0.1, 0.2]

    async def fake_knn(conn, **kwargs):
        assert kwargs["query_vec"] == [0.1, 0.2]
        return []

    monkeypatch.setattr(api_module, "embed_text", fake_embed)
    monkeypatch.setattr(api_module, "scope_claim_knn", fake_knn)
    client = _make_client(monkeypatch, FakeAsyncConnection([make_subscription_cursor()]), fake_user)

    raw = "1. A method comprising:\n   receiving data;\n\n   and  training a model."
    try:
        resp = client.post("/scope_analysis", json={"text": raw, "top_k": 5})
        assert resp.status_code == 200
        # Corpus claim vectors were built from whitespace-collapsed text.
        assert embedded == ["1. A method comprising: receiving data; and training a model."]
        # The user's original text is still echoed back.
        assert resp.json()["query_text"] == raw
    finally:
        _cleanup_client(client)


def test_scope_analysis_passes_patents_only(
    monkeypatch: pytest.MonkeyPatch, fake_user: dict[str, str]
) -> None:
    async def fake_embed(text: str):
        return [0.1, 0.2]

    async def fake_knn(conn, **kwargs):
        assert kwargs["patents_only"] is True
        return []

    monkeypatch.setattr(api_module, "embed_text", fake_embed)
    monkeypatch.setattr(api_module, "scope_claim_knn", fake_knn)
    client = _make_client(monkeypatch, FakeAsyncConnection([make_subscription_cursor()]), fake_user)

    try:
        resp = client.post(
            "/scope_analysis", json={"text": "A method comprising x.", "top_k": 5, "patents_only": True}
        )
        assert resp.status_code == 200
        assert resp.json()["patents_only"] is True
    finally:
        _cleanup_client(client)
