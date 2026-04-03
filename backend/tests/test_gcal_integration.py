"""Integration tests for Google Calendar event listing for both auth modes."""
from unittest.mock import MagicMock, patch

from app.services.gcal_client import CalendarEvent, CalendarGroup


def _mock_groups():
    return [
        CalendarGroup(
            calendar_name="Work",
            calendar_color="#4285f4",
            events=[
                CalendarEvent(id="e1", summary="Standup", start="2026-04-03T09:00:00Z", end="2026-04-03T09:15:00Z", calendar_name="Work", calendar_color="#4285f4"),
                CalendarEvent(id="e2", summary="Review", start="2026-04-03T14:00:00Z", end="2026-04-03T15:00:00Z", calendar_name="Work", calendar_color="#4285f4"),
            ],
        ),
        CalendarGroup(
            calendar_name="Personal",
            calendar_color="#0b8043",
            events=[
                CalendarEvent(id="e3", summary="Lunch", start="2026-04-03T12:00:00Z", end="2026-04-03T13:00:00Z", calendar_name="Personal", calendar_color="#0b8043"),
            ],
        ),
    ]


@patch("app.routes.gcal._get_client")
@patch("app.routes.gcal.settings")
def test_events_daily_returns_grouped_calendars(mock_settings, mock_get_client, client):
    mock_gcal = MagicMock()
    mock_gcal.configured = True
    mock_settings.gcal = mock_gcal

    mock_client = MagicMock()
    mock_client.is_authenticated.return_value = True
    mock_client.list_events.return_value = _mock_groups()
    mock_get_client.return_value = mock_client

    r = client.get("/api/v1/gcal/events?date=2026-04-03&view=daily")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert data[0]["calendar_name"] == "Work"
    assert len(data[0]["events"]) == 2
    assert data[1]["calendar_name"] == "Personal"
    assert len(data[1]["events"]) == 1


@patch("app.routes.gcal._get_client")
@patch("app.routes.gcal.settings")
def test_events_weekly_view(mock_settings, mock_get_client, client):
    mock_gcal = MagicMock()
    mock_gcal.configured = True
    mock_settings.gcal = mock_gcal

    mock_client = MagicMock()
    mock_client.is_authenticated.return_value = True
    mock_client.list_events.return_value = _mock_groups()
    mock_get_client.return_value = mock_client

    r = client.get("/api/v1/gcal/events?date=2026-04-03&view=weekly")
    assert r.status_code == 200
    import datetime
    mock_client.list_events.assert_called_once_with(date=datetime.date(2026, 4, 3), view="weekly")


@patch("app.routes.gcal._get_client")
@patch("app.routes.gcal.settings")
def test_service_account_mode_auto_authenticated(mock_settings, mock_get_client, client):
    mock_gcal = MagicMock()
    mock_gcal.configured = True
    mock_gcal.auth_mode = "service_account"
    mock_settings.gcal = mock_gcal

    mock_client = MagicMock()
    mock_client.is_authenticated.return_value = True
    mock_get_client.return_value = mock_client

    r = client.get("/api/v1/gcal/auth/status")
    assert r.status_code == 200
    data = r.json()
    assert data["configured"] is True
    assert data["authenticated"] is True
    assert data["mode"] == "service_account"
