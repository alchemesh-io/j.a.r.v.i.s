"""Integration tests for JIRA ticket listing with duplicate filtering end-to-end."""
from unittest.mock import MagicMock, patch

from app.models.enums import TaskStatus, TaskType
from app.models.task import Task
from app.services.jira_client import JiraTicket


def _tickets():
    return [
        JiraTicket(key=f"JAR-{i}", summary=f"Ticket {i}", status="To Do", assignee=None, priority=None, description=None, url=f"https://test.atlassian.net/browse/JAR-{i}")
        for i in range(1, 6)
    ]


@patch("app.routes.jira.JiraClient")
@patch("app.routes.jira.settings")
def test_duplicate_filtering_end_to_end(mock_settings, mock_client_cls, client, db_session):
    """Multiple tasks in various states — only non-done linked tickets are excluded."""
    mock_jira = MagicMock()
    mock_jira.configured = True
    mock_settings.jira = mock_jira
    mock_client_cls.return_value.search_tickets.return_value = _tickets()

    # JAR-1: non-done task → filtered out
    db_session.add(Task(title="T1", type=TaskType.implementation, status=TaskStatus.created, jira_ticket_id="JAR-1"))
    # JAR-2: done task → allowed
    db_session.add(Task(title="T2", type=TaskType.review, status=TaskStatus.done, jira_ticket_id="JAR-2"))
    # JAR-3: non-done task → filtered out
    db_session.add(Task(title="T3", type=TaskType.refinement, status=TaskStatus.created, jira_ticket_id="JAR-3"))
    # JAR-4, JAR-5: no task → allowed
    db_session.flush()

    r = client.get("/api/v1/jira/tickets")
    assert r.status_code == 200
    keys = [t["key"] for t in r.json()]
    assert sorted(keys) == ["JAR-2", "JAR-4", "JAR-5"]
