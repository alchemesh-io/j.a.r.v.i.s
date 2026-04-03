from unittest.mock import MagicMock, patch

from app.services.gcal_client import CalendarEvent, CalendarGroup


def _mock_calendar_groups():
    return [
        CalendarGroup(
            calendar_name="Work",
            calendar_color="#4285f4",
            events=[
                CalendarEvent(
                    id="ev1",
                    summary="Sprint Planning",
                    start="2026-04-03T09:00:00+02:00",
                    end="2026-04-03T10:00:00+02:00",
                    calendar_name="Work",
                    calendar_color="#4285f4",
                ),
            ],
        ),
    ]


# --- /gcal/auth/status ---


def test_gcal_auth_status_not_configured(client):
    r = client.get("/api/v1/gcal/auth/status")
    assert r.status_code == 200
    data = r.json()
    assert data["configured"] is False
    assert data["authenticated"] is False
    assert data["mode"] is None


@patch("app.routes.gcal._get_client")
@patch("app.routes.gcal.settings")
def test_gcal_auth_status_oauth2_not_authenticated(mock_settings, mock_get_client, client):
    mock_gcal = MagicMock()
    mock_gcal.configured = True
    mock_gcal.auth_mode = "oauth2"
    mock_settings.gcal = mock_gcal

    mock_client = MagicMock()
    mock_client.is_authenticated.return_value = False
    mock_get_client.return_value = mock_client

    r = client.get("/api/v1/gcal/auth/status")
    assert r.status_code == 200
    data = r.json()
    assert data["configured"] is True
    assert data["authenticated"] is False
    assert data["mode"] == "oauth2"


@patch("app.routes.gcal._get_client")
@patch("app.routes.gcal.settings")
def test_gcal_auth_status_service_account(mock_settings, mock_get_client, client):
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


# --- /gcal/auth/login ---


def test_gcal_auth_login_not_configured(client):
    r = client.get("/api/v1/gcal/auth/login", follow_redirects=False)
    assert r.status_code == 503


@patch("app.routes.gcal._get_client")
@patch("app.routes.gcal.settings")
def test_gcal_auth_login_service_account_rejected(mock_settings, mock_get_client, client):
    mock_gcal = MagicMock()
    mock_gcal.configured = True
    mock_gcal.auth_mode = "service_account"
    mock_settings.gcal = mock_gcal

    r = client.get("/api/v1/gcal/auth/login", follow_redirects=False)
    assert r.status_code == 400


# --- /gcal/events ---


def test_gcal_events_not_configured(client):
    r = client.get("/api/v1/gcal/events?date=2026-04-03")
    assert r.status_code == 503


@patch("app.routes.gcal._get_client")
@patch("app.routes.gcal.settings")
def test_gcal_events_not_authenticated(mock_settings, mock_get_client, client):
    mock_gcal = MagicMock()
    mock_gcal.configured = True
    mock_settings.gcal = mock_gcal

    mock_client = MagicMock()
    mock_client.is_authenticated.return_value = False
    mock_get_client.return_value = mock_client

    r = client.get("/api/v1/gcal/events?date=2026-04-03")
    assert r.status_code == 401


@patch("app.routes.gcal._get_client")
@patch("app.routes.gcal.settings")
def test_gcal_events_success(mock_settings, mock_get_client, client):
    mock_gcal = MagicMock()
    mock_gcal.configured = True
    mock_settings.gcal = mock_gcal

    mock_client = MagicMock()
    mock_client.is_authenticated.return_value = True
    mock_client.list_events.return_value = _mock_calendar_groups()
    mock_get_client.return_value = mock_client

    r = client.get("/api/v1/gcal/events?date=2026-04-03&view=daily")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["calendar_name"] == "Work"
    assert len(data[0]["events"]) == 1
    assert data[0]["events"][0]["summary"] == "Sprint Planning"


@patch("app.routes.gcal._get_client")
@patch("app.routes.gcal.settings")
def test_gcal_events_weekly(mock_settings, mock_get_client, client):
    mock_gcal = MagicMock()
    mock_gcal.configured = True
    mock_settings.gcal = mock_gcal

    mock_client = MagicMock()
    mock_client.is_authenticated.return_value = True
    mock_client.list_events.return_value = _mock_calendar_groups()
    mock_get_client.return_value = mock_client

    r = client.get("/api/v1/gcal/events?date=2026-04-03&view=weekly")
    assert r.status_code == 200
    mock_client.list_events.assert_called_once()
