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


# --- JIRA ---


@pytest.mark.asyncio
async def test_get_jira_config(mock_backend, client):
    mock_backend.get("/api/v1/jira/config").respond(
        200,
        json={"configured": True, "projectUrl": "https://example.atlassian.net"},
    )
    result = await client.get_jira_config()
    assert result["configured"] is True


@pytest.mark.asyncio
async def test_list_jira_tickets(mock_backend, client):
    mock_backend.get("/api/v1/jira/tickets").respond(
        200,
        json=[
            {"key": "AG-1", "summary": "Setup", "status": "To Do", "assignee": None, "priority": "Medium", "description": None, "url": "https://example.atlassian.net/browse/AG-1"},
        ],
    )
    result = await client.list_jira_tickets()
    assert len(result) == 1
    assert result[0]["key"] == "AG-1"


@pytest.mark.asyncio
async def test_get_jira_ticket(mock_backend, client):
    mock_backend.get("/api/v1/jira/ticket").respond(
        200,
        json={"key": "AG-22", "summary": "Data Mesh Console", "status": "In Progress", "assignee": "alex", "priority": "High", "description": "desc", "url": "https://example.atlassian.net/browse/AG-22"},
    )
    result = await client.get_jira_ticket(key="AG-22")
    assert result["key"] == "AG-22"


# --- Google Calendar ---


@pytest.mark.asyncio
async def test_get_gcal_auth_status(mock_backend, client):
    mock_backend.get("/api/v1/gcal/auth/status").respond(
        200,
        json={"configured": True, "authenticated": True, "mode": "oauth2", "calendarEmail": "user@example.com"},
    )
    result = await client.get_gcal_auth_status()
    assert result["authenticated"] is True


@pytest.mark.asyncio
async def test_list_gcal_events(mock_backend, client):
    mock_backend.get("/api/v1/gcal/events").respond(
        200,
        json=[
            {"calendar_name": "Work", "calendar_color": "#4285f4", "events": [
                {"id": "ev1", "summary": "Standup", "start": "2026-04-07T09:00:00", "end": "2026-04-07T09:15:00", "description": None, "location": None, "attendees": [], "attachments": [], "html_link": None, "calendar_name": "Work", "calendar_color": "#4285f4"},
            ]},
        ],
    )
    result = await client.list_gcal_events(date="2026-04-07")
    assert len(result) == 1
    assert result[0]["events"][0]["summary"] == "Standup"


@pytest.mark.asyncio
async def test_get_gcal_event(mock_backend, client):
    mock_backend.get("/api/v1/gcal/event").respond(
        200,
        json={"id": "ev1", "summary": "Standup", "start": "2026-04-07T09:00:00", "end": "2026-04-07T09:15:00", "description": None, "location": None, "attendees": [], "attachments": [], "html_link": None, "calendar_name": "Work", "calendar_color": "#4285f4"},
    )
    result = await client.get_gcal_event(event_id="ev1")
    assert result["id"] == "ev1"


@pytest.mark.asyncio
async def test_backend_unreachable(client):
    bad_client = BackendClient(base_url="http://localhost:1")
    with pytest.raises(RuntimeError, match="Backend unreachable"):
        await bad_client.create_task(title="Test", type="review")
    await bad_client.close()
