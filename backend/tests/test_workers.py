from unittest.mock import patch


def _create_task(client, title="Test task"):
    return client.post(
        "/api/v1/tasks",
        json={"title": title, "type": "implementation", "status": "created"},
    )


def _create_repo(client, git_url="https://github.com/org/repo", branch="main"):
    return client.post("/api/v1/repositories", json={"git_url": git_url, "branch": branch})


@patch("app.routes.workers.k8s")
def test_create_worker(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    resp = client.post("/api/v1/workers", json={"task_id": task["id"]})
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["id"]) == 32
    assert data["task_id"] == task["id"]
    assert data["state"] == "initialized"
    assert data["type"] == "claude_code"
    assert data["effective_state"] == "initialized"


@patch("app.routes.workers.k8s")
def test_create_worker_with_repos(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    r1 = _create_repo(client, git_url="https://github.com/org/repo1").json()
    r2 = _create_repo(client, git_url="https://github.com/org/repo2").json()
    resp = client.post(
        "/api/v1/workers",
        json={"task_id": task["id"], "repository_ids": [r1["id"], r2["id"]]},
    )
    assert resp.status_code == 201
    assert len(resp.json()["repositories"]) == 2


@patch("app.routes.workers.k8s")
def test_create_worker_duplicate_task_returns_409(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    client.post("/api/v1/workers", json={"task_id": task["id"]})
    resp = client.post("/api/v1/workers", json={"task_id": task["id"]})
    assert resp.status_code == 409


@patch("app.routes.workers.k8s")
def test_create_worker_nonexistent_task_returns_404(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    resp = client.post("/api/v1/workers", json={"task_id": 9999})
    assert resp.status_code == 404


@patch("app.routes.workers.k8s")
def test_create_worker_nonexistent_repo_returns_404(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    resp = client.post(
        "/api/v1/workers",
        json={"task_id": task["id"], "repository_ids": [9999]},
    )
    assert resp.status_code == 404


@patch("app.routes.workers.k8s")
def test_list_workers(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    t1 = _create_task(client, title="Task 1").json()
    t2 = _create_task(client, title="Task 2").json()
    client.post("/api/v1/workers", json={"task_id": t1["id"]})
    client.post("/api/v1/workers", json={"task_id": t2["id"]})
    resp = client.get("/api/v1/workers")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


@patch("app.routes.workers.k8s")
def test_list_workers_empty(mock_k8s, client):
    resp = client.get("/api/v1/workers")
    assert resp.status_code == 200
    assert resp.json() == []


@patch("app.routes.workers.k8s")
def test_get_worker(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    mock_k8s.get_worker_pod_status.return_value = None
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()
    resp = client.get(f"/api/v1/workers/{worker['id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == worker["id"]


@patch("app.routes.workers.k8s")
def test_get_worker_with_live_status(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()

    mock_k8s.get_worker_pod_status.return_value = {"state": "working"}
    resp = client.get(f"/api/v1/workers/{worker['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["state"] == "initialized"
    assert data["effective_state"] == "working"


@patch("app.routes.workers.k8s")
def test_get_worker_pod_unreachable(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()

    mock_k8s.get_worker_pod_status.return_value = None
    resp = client.get(f"/api/v1/workers/{worker['id']}")
    assert resp.status_code == 200
    assert resp.json()["pod_status"] == "unreachable"


@patch("app.routes.workers.k8s")
def test_get_nonexistent_worker(mock_k8s, client):
    resp = client.get("/api/v1/workers/nonexistent")
    assert resp.status_code == 404


@patch("app.routes.workers.k8s")
def test_update_worker_state(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()

    resp = client.patch(f"/api/v1/workers/{worker['id']}", json={"state": "done"})
    assert resp.status_code == 200
    assert resp.json()["state"] == "done"


@patch("app.routes.workers.k8s")
def test_archive_worker_deletes_k8s_resources(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()

    resp = client.patch(f"/api/v1/workers/{worker['id']}", json={"state": "archived"})
    assert resp.status_code == 200
    assert resp.json()["state"] == "archived"
    mock_k8s.delete_worker_resources.assert_called_with(worker["id"])


@patch("app.routes.workers.k8s")
def test_delete_worker(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()

    resp = client.delete(f"/api/v1/workers/{worker['id']}")
    assert resp.status_code == 204
    mock_k8s.delete_worker_resources.assert_called_with(worker["id"])
    assert client.get(f"/api/v1/workers/{worker['id']}").status_code == 404


@patch("app.routes.workers.k8s")
def test_delete_nonexistent_worker(mock_k8s, client):
    resp = client.delete("/api/v1/workers/nonexistent")
    assert resp.status_code == 404


@patch("app.routes.workers.k8s")
def test_task_response_includes_worker(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()

    resp = client.get(f"/api/v1/tasks/{task['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["worker"] is not None
    assert data["worker"]["id"] == worker["id"]


@patch("app.routes.workers.k8s")
def test_task_response_without_worker(mock_k8s, client):
    task = _create_task(client).json()
    resp = client.get(f"/api/v1/tasks/{task['id']}")
    assert resp.status_code == 200
    assert resp.json()["worker"] is None


@patch("app.routes.workers.k8s")
def test_task_list_includes_worker(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    t1 = _create_task(client, title="With worker").json()
    _create_task(client, title="Without worker")
    client.post("/api/v1/workers", json={"task_id": t1["id"]})

    resp = client.get("/api/v1/tasks")
    assert resp.status_code == 200
    tasks = resp.json()
    with_worker = [t for t in tasks if t["worker"] is not None]
    without_worker = [t for t in tasks if t["worker"] is None]
    assert len(with_worker) == 1
    assert len(without_worker) == 1


@patch("app.routes.workers.k8s")
def test_create_worker_with_k8s(mock_k8s, client):
    mock_k8s.is_available.return_value = True
    task = _create_task(client).json()
    resp = client.post("/api/v1/workers", json={"task_id": task["id"]})
    assert resp.status_code == 201
    mock_k8s.create_worker_pod.assert_called_once()
    mock_k8s.create_worker_service.assert_called_once()
    mock_k8s.create_worker_httproute.assert_called_once()


@patch("app.routes.workers.k8s")
def test_create_worker_k8s_failure_returns_503(mock_k8s, client):
    mock_k8s.is_available.return_value = True
    mock_k8s.create_worker_pod.side_effect = RuntimeError("K8s error")
    task = _create_task(client).json()
    resp = client.post("/api/v1/workers", json={"task_id": task["id"]})
    assert resp.status_code == 503


@patch("app.routes.tasks.k8s")
@patch("app.routes.workers.k8s")
def test_task_deletion_cleans_up_worker_k8s(mock_worker_k8s, mock_task_k8s, client):
    mock_worker_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()

    resp = client.delete(f"/api/v1/tasks/{task['id']}")
    assert resp.status_code == 204
    mock_task_k8s.delete_worker_resources.assert_called_with(worker["id"])


@patch("app.routes.tasks.k8s")
def test_task_deletion_without_worker(mock_task_k8s, client):
    task = _create_task(client).json()
    resp = client.delete(f"/api/v1/tasks/{task['id']}")
    assert resp.status_code == 204
    mock_task_k8s.delete_worker_resources.assert_not_called()
