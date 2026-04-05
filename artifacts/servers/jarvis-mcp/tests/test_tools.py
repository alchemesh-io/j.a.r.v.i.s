import pytest
import httpx
import respx

from api_client import BackendClient


@pytest.fixture
def mock_backend():
    with respx.mock(base_url="http://test-backend:8000") as mock:
        yield mock


@pytest.fixture
def client():
    return BackendClient(base_url="http://test-backend:8000")


@pytest.mark.asyncio
async def test_create_task(mock_backend, client):
    mock_backend.post("/api/v1/tasks").respond(
        201,
        json={"id": 1, "title": "Test", "type": "review", "status": "created", "jira_ticket_id": None},
    )
    result = await client.create_task(title="Test", type="review")
    assert result["id"] == 1
    assert result["title"] == "Test"


@pytest.mark.asyncio
async def test_list_tasks(mock_backend, client):
    mock_backend.get("/api/v1/tasks").respond(
        200,
        json=[
            {"id": 1, "title": "T1", "type": "review", "status": "created", "jira_ticket_id": None},
            {"id": 2, "title": "T2", "type": "implementation", "status": "done", "jira_ticket_id": "JAR-1"},
        ],
    )
    result = await client.list_tasks()
    assert len(result) == 2


@pytest.mark.asyncio
async def test_update_task(mock_backend, client):
    mock_backend.patch("/api/v1/tasks/1").respond(
        200,
        json={"id": 1, "title": "Updated", "type": "review", "status": "done", "jira_ticket_id": None},
    )
    result = await client.update_task(1, title="Updated", status="done")
    assert result["title"] == "Updated"
    assert result["status"] == "done"


@pytest.mark.asyncio
async def test_delete_task(mock_backend, client):
    mock_backend.delete("/api/v1/tasks/1").respond(204)
    result = await client.delete_task(1)
    assert result is None


@pytest.mark.asyncio
async def test_create_daily(mock_backend, client):
    mock_backend.post("/api/v1/dailies").respond(
        201,
        json={"id": 1, "date": "2026-03-30", "weekly_id": 1, "tasks": []},
    )
    result = await client.create_daily(date="2026-03-30", weekly_id=1)
    assert result["date"] == "2026-03-30"


@pytest.mark.asyncio
async def test_add_task_to_daily(mock_backend, client):
    mock_backend.post("/api/v1/dailies/1/tasks").respond(
        201,
        json={
            "daily_id": 1,
            "task_id": 1,
            "priority": 1,
            "task": {"id": 1, "title": "T", "type": "review", "status": "created", "jira_ticket_id": None},
        },
    )
    result = await client.add_task_to_daily(daily_id=1, task_id=1, priority=1)
    assert result["priority"] == 1


@pytest.mark.asyncio
async def test_remove_task_from_daily(mock_backend, client):
    mock_backend.delete("/api/v1/dailies/1/tasks/1").respond(204)
    result = await client.remove_task_from_daily(daily_id=1, task_id=1)
    assert result is None


@pytest.mark.asyncio
async def test_get_daily_by_date(mock_backend, client):
    mock_backend.get("/api/v1/dailies").respond(
        200,
        json={"id": 1, "date": "2026-03-30", "weekly_id": 1, "tasks": []},
    )
    result = await client.get_daily_by_date(date="2026-03-30")
    assert result["id"] == 1


@pytest.mark.asyncio
async def test_list_weekly_tasks(mock_backend, client):
    mock_backend.get("/api/v1/tasks").respond(
        200,
        json=[{"id": 1, "title": "T1", "type": "review", "status": "created", "jira_ticket_id": None}],
    )
    result = await client.list_weekly_tasks(date="2026-03-30")
    assert len(result) == 1


@pytest.mark.asyncio
async def test_backend_unreachable(client):
    # Use a port that's not listening
    bad_client = BackendClient(base_url="http://localhost:1")
    with pytest.raises(RuntimeError, match="Backend unreachable"):
        await bad_client.create_task(title="Test", type="review")
    await bad_client.close()
