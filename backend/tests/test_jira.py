from unittest.mock import patch, MagicMock

from app.services.jira_client import JiraTicket


def _mock_jira_tickets():
    return [
        JiraTicket(key="JAR-1", summary="Fix login", status="To Do", url="https://test.atlassian.net/browse/JAR-1"),
        JiraTicket(key="JAR-2", summary="Add feature", status="In Progress", url="https://test.atlassian.net/browse/JAR-2"),
        JiraTicket(key="JAR-3", summary="Refactor", status="Done", url="https://test.atlassian.net/browse/JAR-3"),
    ]


# --- /jira/config ---


def test_jira_config_not_configured(client):
    r = client.get("/api/v1/jira/config")
    assert r.status_code == 200
    data = r.json()
    assert data["configured"] is False
    assert data["projectUrl"] is None


@patch("app.routes.jira.settings")
def test_jira_config_configured(mock_settings, client):
    mock_jira = MagicMock()
    mock_jira.configured = True
    mock_jira.project_url = "https://test.atlassian.net"
    mock_settings.jira = mock_jira

    r = client.get("/api/v1/jira/config")
    assert r.status_code == 200
    data = r.json()
    assert data["configured"] is True
    assert data["projectUrl"] == "https://test.atlassian.net"


# --- /jira/tickets ---


def test_jira_tickets_not_configured(client):
    r = client.get("/api/v1/jira/tickets")
    assert r.status_code == 503


@patch("app.routes.jira.JiraClient")
@patch("app.routes.jira.settings")
def test_jira_tickets_returns_filtered_list(mock_settings, mock_client_cls, client, db_session):
    mock_jira = MagicMock()
    mock_jira.configured = True
    mock_settings.jira = mock_jira

    mock_client_cls.return_value.search_tickets.return_value = _mock_jira_tickets()

    # Create a non-done task linked to JAR-1 — should be filtered out
    from app.models.task import Task
    from app.models.enums import TaskStatus, TaskType

    task = Task(title="Existing", type=TaskType.implementation, status=TaskStatus.created, jira_ticket_id="JAR-1")
    db_session.add(task)
    db_session.flush()

    r = client.get("/api/v1/jira/tickets")
    assert r.status_code == 200
    keys = [t["key"] for t in r.json()]
    assert "JAR-1" not in keys
    assert "JAR-2" in keys
    assert "JAR-3" in keys


@patch("app.routes.jira.JiraClient")
@patch("app.routes.jira.settings")
def test_jira_tickets_allows_done_task_reimport(mock_settings, mock_client_cls, client, db_session):
    mock_jira = MagicMock()
    mock_jira.configured = True
    mock_settings.jira = mock_jira

    mock_client_cls.return_value.search_tickets.return_value = _mock_jira_tickets()

    # Create a done task linked to JAR-1 — should NOT be filtered out
    from app.models.task import Task
    from app.models.enums import TaskStatus, TaskType

    task = Task(title="Done task", type=TaskType.implementation, status=TaskStatus.done, jira_ticket_id="JAR-1")
    db_session.add(task)
    db_session.flush()

    r = client.get("/api/v1/jira/tickets")
    assert r.status_code == 200
    keys = [t["key"] for t in r.json()]
    assert "JAR-1" in keys


@patch("app.routes.jira.JiraClient")
@patch("app.routes.jira.settings")
def test_jira_tickets_api_error(mock_settings, mock_client_cls, client):
    from jira import JIRAError

    mock_jira = MagicMock()
    mock_jira.configured = True
    mock_settings.jira = mock_jira

    mock_client_cls.return_value.search_tickets.side_effect = JIRAError(text="Unauthorized")

    r = client.get("/api/v1/jira/tickets")
    assert r.status_code == 502
    assert "JIRA API error" in r.json()["detail"]
