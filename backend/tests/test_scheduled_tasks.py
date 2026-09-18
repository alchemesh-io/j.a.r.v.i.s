from unittest.mock import patch


def _create_scheduled_task(client, **overrides):
    body = {
        "title": "Nightly sync",
        "task_type": "implementation",
        "cron_expression": "0 20 * * *",
    }
    body.update(overrides)
    return client.post("/api/v1/scheduled-tasks", json=body)


def _create_repo(client, git_url="https://github.com/org/repo", branch="main"):
    return client.post("/api/v1/repositories", json={"git_url": git_url, "branch": branch})


def test_create_scheduled_task(client):
    resp = _create_scheduled_task(client)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Nightly sync"
    assert data["task_type"] == "implementation"
    assert data["cron_expression"] == "0 20 * * *"
    assert data["status"] == "active"
    assert data["worker_type"] == "claude_code"
    assert data["worker_mode"] == "ephemeral"
    assert data["worker_session_mode"] == "auto"
    assert data["repositories"] == []
    assert data["skills"] == []
    assert data["last_run_at"] is None
    assert data["next_run_at"] is not None


def test_create_scheduled_task_invalid_cron_returns_400(client):
    resp = _create_scheduled_task(client, cron_expression="not a cron")
    assert resp.status_code == 400


def test_create_scheduled_task_paused_has_no_next_run(client):
    resp = _create_scheduled_task(client, status="paused")
    assert resp.status_code == 201
    assert resp.json()["next_run_at"] is None


def test_create_scheduled_task_with_repositories(client):
    repo = _create_repo(client).json()
    resp = _create_scheduled_task(client, repository_ids=[repo["id"]])
    assert resp.status_code == 201
    assert len(resp.json()["repositories"]) == 1
    assert resp.json()["repositories"][0]["id"] == repo["id"]


def test_create_scheduled_task_nonexistent_repository_returns_404(client):
    resp = _create_scheduled_task(client, repository_ids=[9999])
    assert resp.status_code == 404


def test_create_scheduled_task_with_skills_and_worker_overrides(client):
    resp = _create_scheduled_task(
        client,
        skills=[{"name": "some-skill", "version": "1.2.3"}],
        worker_mode="stateful",
        worker_session_mode="plan",
        worker_cpu_request="500m",
        worker_memory_request="512Mi",
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["skills"] == [{"name": "some-skill", "version": "1.2.3"}]
    assert data["worker_mode"] == "stateful"
    assert data["worker_session_mode"] == "plan"
    assert data["worker_cpu_request"] == "500m"
    assert data["worker_memory_request"] == "512Mi"


def test_list_scheduled_tasks(client):
    _create_scheduled_task(client, title="A")
    _create_scheduled_task(client, title="B")
    resp = client.get("/api/v1/scheduled-tasks")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_list_scheduled_tasks_empty(client):
    resp = client.get("/api/v1/scheduled-tasks")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_scheduled_task(client):
    created = _create_scheduled_task(client).json()
    resp = client.get(f"/api/v1/scheduled-tasks/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == created["id"]


def test_get_nonexistent_scheduled_task_returns_404(client):
    resp = client.get("/api/v1/scheduled-tasks/9999")
    assert resp.status_code == 404


def test_update_scheduled_task_title(client):
    created = _create_scheduled_task(client).json()
    resp = client.patch(f"/api/v1/scheduled-tasks/{created['id']}", json={"title": "Renamed"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Renamed"
    # Untouched fields survive the partial update.
    assert resp.json()["cron_expression"] == "0 20 * * *"


def test_update_scheduled_task_invalid_cron_returns_400(client):
    created = _create_scheduled_task(client).json()
    resp = client.patch(f"/api/v1/scheduled-tasks/{created['id']}", json={"cron_expression": "nope"})
    assert resp.status_code == 400


def test_update_scheduled_task_cron_recomputes_next_run(client):
    created = _create_scheduled_task(client).json()
    original_next_run = created["next_run_at"]
    resp = client.patch(f"/api/v1/scheduled-tasks/{created['id']}", json={"cron_expression": "0 0 1 1 *"})
    assert resp.status_code == 200
    assert resp.json()["next_run_at"] != original_next_run


def test_update_scheduled_task_pause_clears_next_run(client):
    created = _create_scheduled_task(client).json()
    resp = client.patch(f"/api/v1/scheduled-tasks/{created['id']}", json={"status": "paused"})
    assert resp.status_code == 200
    assert resp.json()["next_run_at"] is None
    assert resp.json()["status"] == "paused"


def test_update_scheduled_task_reactivate_sets_next_run(client):
    created = _create_scheduled_task(client, status="paused").json()
    assert created["next_run_at"] is None
    resp = client.patch(f"/api/v1/scheduled-tasks/{created['id']}", json={"status": "active"})
    assert resp.status_code == 200
    assert resp.json()["next_run_at"] is not None


def test_update_scheduled_task_repositories(client):
    repo1 = _create_repo(client, git_url="https://github.com/org/repo1").json()
    repo2 = _create_repo(client, git_url="https://github.com/org/repo2").json()
    created = _create_scheduled_task(client, repository_ids=[repo1["id"]]).json()

    resp = client.patch(
        f"/api/v1/scheduled-tasks/{created['id']}", json={"repository_ids": [repo2["id"]]}
    )
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()["repositories"]]
    assert ids == [repo2["id"]]


def test_update_nonexistent_scheduled_task_returns_404(client):
    resp = client.patch("/api/v1/scheduled-tasks/9999", json={"title": "x"})
    assert resp.status_code == 404


def test_delete_scheduled_task(client):
    created = _create_scheduled_task(client).json()
    resp = client.delete(f"/api/v1/scheduled-tasks/{created['id']}")
    assert resp.status_code == 204
    assert client.get(f"/api/v1/scheduled-tasks/{created['id']}").status_code == 404


def test_delete_nonexistent_scheduled_task_returns_404(client):
    resp = client.delete("/api/v1/scheduled-tasks/9999")
    assert resp.status_code == 404


def test_delete_repository_in_use_by_scheduled_task_returns_409(client):
    repo = _create_repo(client).json()
    _create_scheduled_task(client, repository_ids=[repo["id"]])
    resp = client.delete(f"/api/v1/repositories/{repo['id']}")
    assert resp.status_code == 409


@patch("app.services.scheduler.k8s")
def test_run_scheduled_task_now_creates_task_and_worker(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    created = _create_scheduled_task(client, note_content="Do the thing").json()

    resp = client.post(f"/api/v1/scheduled-tasks/{created['id']}/run")
    assert resp.status_code == 200
    result = resp.json()
    assert "task_id" in result
    assert "worker_id" in result

    task_resp = client.get(f"/api/v1/tasks/{result['task_id']}")
    assert task_resp.status_code == 200
    assert task_resp.json()["title"] == "Nightly sync"
    assert task_resp.json()["note_count"] == 1

    worker_resp = client.get(f"/api/v1/workers/{result['worker_id']}")
    assert worker_resp.status_code == 200
    assert worker_resp.json()["task_id"] == result["task_id"]

    updated = client.get(f"/api/v1/scheduled-tasks/{created['id']}").json()
    assert updated["last_run_at"] is not None


@patch("app.services.scheduler.k8s")
def test_run_scheduled_task_now_on_paused_schedule_leaves_next_run_none(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    created = _create_scheduled_task(client, status="paused").json()
    resp = client.post(f"/api/v1/scheduled-tasks/{created['id']}/run")
    assert resp.status_code == 200

    updated = client.get(f"/api/v1/scheduled-tasks/{created['id']}").json()
    assert updated["last_run_at"] is not None
    assert updated["next_run_at"] is None


def test_run_nonexistent_scheduled_task_returns_404(client):
    resp = client.post("/api/v1/scheduled-tasks/9999/run")
    assert resp.status_code == 404
