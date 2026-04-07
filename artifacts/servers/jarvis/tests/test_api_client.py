"""Tests for the J.A.R.V.I.S backend API client."""

import sys
from pathlib import Path

import pytest
import respx

# Add src to Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.api_client import BackendClient  # noqa: E402


@pytest.fixture
def mock_backend():
    with respx.mock(base_url="http://test-backend:8000") as mock:
        yield mock


@pytest.fixture
def client():
    return BackendClient(base_url="http://test-backend:8000")


# --- Tasks ---


@pytest.mark.asyncio
async def test_create_task(mock_backend, client):
    mock_backend.post("/api/v1/tasks").respond(
        201,
        json={"id": 1, "title": "Test", "type": "review", "status": "created", "source_type": None, "source_id": None, "dates": []},
    )
    result = await client.create_task(title="Test", type="review")
    assert result["id"] == 1


@pytest.mark.asyncio
async def test_create_task_with_source(mock_backend, client):
    mock_backend.post("/api/v1/tasks").respond(
        201,
        json={"id": 2, "title": "JIRA task", "type": "implementation", "status": "created", "source_type": "jira", "source_id": "AG-22", "dates": []},
    )
    result = await client.create_task(title="JIRA task", type="implementation", source_type="jira", source_id="AG-22")
    assert result["source_type"] == "jira"
    assert result["source_id"] == "AG-22"


@pytest.mark.asyncio
async def test_get_task(mock_backend, client):
    mock_backend.get("/api/v1/tasks/1").respond(
        200,
        json={"id": 1, "title": "Test", "type": "review", "status": "created", "source_type": None, "source_id": None, "dates": ["2026-04-07"]},
    )
    result = await client.get_task(1)
    assert result["id"] == 1
    assert result["dates"] == ["2026-04-07"]


@pytest.mark.asyncio
async def test_list_tasks(mock_backend, client):
    mock_backend.get("/api/v1/tasks").respond(
        200,
        json=[
            {"id": 1, "title": "T1", "type": "review", "status": "created", "source_type": None, "source_id": None, "dates": []},
            {"id": 2, "title": "T2", "type": "implementation", "status": "done", "source_type": "jira", "source_id": "JAR-1", "dates": []},
        ],
    )
    result = await client.list_tasks()
    assert len(result) == 2


@pytest.mark.asyncio
async def test_update_task(mock_backend, client):
    mock_backend.patch("/api/v1/tasks/1").respond(
        200,
        json={"id": 1, "title": "Updated", "type": "review", "status": "done", "source_type": None, "source_id": None, "dates": []},
    )
    result = await client.update_task(1, title="Updated", status="done")
    assert result["title"] == "Updated"
    assert result["status"] == "done"


@pytest.mark.asyncio
async def test_delete_task(mock_backend, client):
    mock_backend.delete("/api/v1/tasks/1").respond(204)
    result = await client.delete_task(1)
    assert result is None


# --- Weeklies ---


@pytest.mark.asyncio
async def test_create_weekly(mock_backend, client):
    mock_backend.post("/api/v1/weeklies").respond(
        201,
        json={"id": 1, "week_start": "2026-04-05", "dailies": []},
    )
    result = await client.create_weekly(week_start="2026-04-05")
    assert result["week_start"] == "2026-04-05"


@pytest.mark.asyncio
async def test_list_weeklies(mock_backend, client):
    mock_backend.get("/api/v1/weeklies").respond(
        200,
        json=[{"id": 1, "week_start": "2026-04-05", "dailies": []}],
    )
    result = await client.list_weeklies()
    assert len(result) == 1


@pytest.mark.asyncio
async def test_get_weekly(mock_backend, client):
    mock_backend.get("/api/v1/weeklies/1").respond(
        200,
        json={"id": 1, "week_start": "2026-04-05", "dailies": []},
    )
    result = await client.get_weekly(1)
    assert result["id"] == 1


# --- Dailies ---


@pytest.mark.asyncio
async def test_create_daily(mock_backend, client):
    mock_backend.post("/api/v1/dailies").respond(
        201,
        json={"id": 1, "date": "2026-04-07", "weekly_id": 1, "tasks": []},
    )
    result = await client.create_daily(date="2026-04-07", weekly_id=1)
    assert result["date"] == "2026-04-07"


@pytest.mark.asyncio
async def test_get_daily(mock_backend, client):
    mock_backend.get("/api/v1/dailies/1").respond(
        200,
        json={"id": 1, "date": "2026-04-07", "weekly_id": 1, "tasks": []},
    )
    result = await client.get_daily(1)
    assert result["id"] == 1


@pytest.mark.asyncio
async def test_get_daily_by_date(mock_backend, client):
    mock_backend.get("/api/v1/dailies").respond(
        200,
        json={"id": 1, "date": "2026-04-07", "weekly_id": 1, "tasks": []},
    )
    result = await client.get_daily_by_date(date="2026-04-07")
    assert result["id"] == 1


# --- Daily Tasks ---


@pytest.mark.asyncio
async def test_add_task_to_daily(mock_backend, client):
    mock_backend.post("/api/v1/dailies/1/tasks").respond(
        201,
        json={"daily_id": 1, "task_id": 1, "priority": 1, "task": {"id": 1, "title": "T", "type": "review", "status": "created", "source_type": None, "source_id": None}},
    )
    result = await client.add_task_to_daily(daily_id=1, task_id=1, priority=1)
    assert result["priority"] == 1


@pytest.mark.asyncio
async def test_remove_task_from_daily(mock_backend, client):
    mock_backend.delete("/api/v1/dailies/1/tasks/1").respond(204)
    result = await client.remove_task_from_daily(daily_id=1, task_id=1)
    assert result is None


@pytest.mark.asyncio
async def test_reorder_daily_tasks(mock_backend, client):
    mock_backend.put("/api/v1/dailies/1/tasks/reorder").respond(
        200,
        json=[
            {"daily_id": 1, "task_id": 2, "priority": 1, "task": {"id": 2, "title": "T2", "type": "review", "status": "created", "source_type": None, "source_id": None}},
            {"daily_id": 1, "task_id": 1, "priority": 2, "task": {"id": 1, "title": "T1", "type": "review", "status": "created", "source_type": None, "source_id": None}},
        ],
    )
    result = await client.reorder_daily_tasks(daily_id=1, items=[{"task_id": 2, "priority": 1}, {"task_id": 1, "priority": 2}])
    assert len(result) == 2
    assert result[0]["task_id"] == 2


# --- Error handling ---


@pytest.mark.asyncio
async def test_backend_unreachable(client):
    bad_client = BackendClient(base_url="http://localhost:1")
    with pytest.raises(RuntimeError, match="Backend unreachable"):
        await bad_client.create_task(title="Test", type="review")
    await bad_client.close()
