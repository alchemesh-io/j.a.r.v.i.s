from unittest.mock import MagicMock, patch

from app.services import agent_registry


def test_list_skills_unconfigured_project():
    with patch.object(agent_registry, "AGENT_REGISTRY_PROJECT", ""):
        assert agent_registry.list_skills() == []


def test_list_skills_auth_failure():
    with (
        patch.object(agent_registry, "AGENT_REGISTRY_PROJECT", "proj"),
        patch("google.auth.default", side_effect=Exception("no credentials")),
    ):
        assert agent_registry.list_skills() == []


def test_list_skills_transport_error():
    mock_creds = MagicMock()
    with (
        patch.object(agent_registry, "AGENT_REGISTRY_PROJECT", "proj"),
        patch("google.auth.default", return_value=(mock_creds, "proj")),
        patch("httpx.get", side_effect=Exception("network error")),
    ):
        assert agent_registry.list_skills() == []


def test_list_skills_success():
    mock_creds = MagicMock()
    mock_creds.token = "fake-token"
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "skills": [
            {
                "name": "projects/proj/locations/global/skills/private-planner-daily-wrap-up",
                "displayName": "planner-daily-wrap-up",
                "description": "Wrap up the day",
                "defaultRevision": "projects/proj/locations/global/skills/private-planner-daily-wrap-up/revisions/v2",
            },
            {
                "name": "projects/proj/locations/global/skills/discoveryengine.googleapis.com-email-writing-style",
                "displayName": "email-writing-style",
                "publisher": "projects/proj/locations/global/publishers/discoveryengine.googleapis.com",
                "defaultRevision": "projects/proj/locations/global/skills/discoveryengine.googleapis.com-email-writing-style/revisions/v1",
            },
        ],
    }
    mock_response.raise_for_status = MagicMock()
    with (
        patch.object(agent_registry, "AGENT_REGISTRY_PROJECT", "proj"),
        patch("google.auth.default", return_value=(mock_creds, "proj")),
        patch("httpx.get", return_value=mock_response),
    ):
        result = agent_registry.list_skills()

    # Only the un-published (no "publisher" field) skill is JARVIS's own.
    assert result == [
        {
            "name": "planner-daily-wrap-up",
            "description": "Wrap up the day",
            "version": "v2",
            "is_latest": True,
        }
    ]


def test_get_skills_route(client):
    with patch("app.routes.skills.agent_registry.list_skills", return_value=[]):
        resp = client.get("/api/v1/skills")
    assert resp.status_code == 200
    assert resp.json() == []
