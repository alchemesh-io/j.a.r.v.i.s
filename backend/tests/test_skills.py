from unittest.mock import MagicMock, patch

from app.routes import skills as skills_route


class _FakeIterator(list):
    def __init__(self, prefixes):
        super().__init__()
        self.prefixes = prefixes


def _fake_list_blobs(prefixes_by_prefix):
    def list_blobs(bucket, prefix=None, delimiter=None):
        return _FakeIterator(prefixes_by_prefix.get(prefix, set()))

    return list_blobs


@patch("app.routes.skills._get_client")
def test_list_skills_empty_when_bucket_unconfigured(mock_get_client, client):
    with patch.object(skills_route, "SKILLS_BUCKET", ""):
        resp = client.get("/api/v1/skills")
    assert resp.status_code == 200
    assert resp.json() == []
    mock_get_client.assert_not_called()


@patch("app.routes.skills._get_client")
def test_list_skills_empty_when_client_unavailable(mock_get_client, client):
    mock_get_client.return_value = None
    with patch.object(skills_route, "SKILLS_BUCKET", "jarvis-skills"):
        resp = client.get("/api/v1/skills")
    assert resp.status_code == 200
    assert resp.json() == []


@patch("app.routes.skills._get_client")
def test_list_skills_lists_versions_from_bucket(mock_get_client, client):
    mock_bucket = MagicMock()
    mock_client = MagicMock()
    mock_client.bucket.return_value = mock_bucket
    mock_client.list_blobs.side_effect = _fake_list_blobs(
        {
            None: {"planner-daily-wrap-up/"},
            "planner-daily-wrap-up/": {
                "planner-daily-wrap-up/0.1.0/",
                "planner-daily-wrap-up/latest/",
            },
        }
    )

    def blob_side_effect(path):
        blob = MagicMock()
        blob.exists.return_value = True
        blob.download_as_text.return_value = (
            "---\nname: planner-daily-wrap-up\ndescription: Wrap up the day\n---\n"
        )
        return blob

    mock_bucket.blob.side_effect = blob_side_effect
    mock_get_client.return_value = mock_client

    with patch.object(skills_route, "SKILLS_BUCKET", "jarvis-skills"):
        resp = client.get("/api/v1/skills")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert {d["name"] for d in data} == {"planner-daily-wrap-up"}
    assert {d["version"] for d in data} == {"0.1.0", "latest"}
    latest_entries = [d for d in data if d["is_latest"]]
    assert len(latest_entries) == 1
    assert latest_entries[0]["version"] == "latest"
    assert all(d["description"] == "Wrap up the day" for d in data)


@patch("app.routes.skills._get_client")
def test_list_skills_returns_empty_on_gcs_error(mock_get_client, client):
    mock_client = MagicMock()
    mock_client.bucket.side_effect = RuntimeError("boom")
    mock_get_client.return_value = mock_client

    with patch.object(skills_route, "SKILLS_BUCKET", "jarvis-skills"):
        resp = client.get("/api/v1/skills")

    assert resp.status_code == 200
    assert resp.json() == []
