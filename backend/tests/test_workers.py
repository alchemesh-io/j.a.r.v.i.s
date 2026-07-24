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
    mock_k8s.get_pod_phase.return_value = (None, None)
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

    mock_k8s.get_pod_phase.return_value = ("Running", None)
    mock_k8s.get_worker_pod_status.return_value = {"state": "working"}
    resp = client.get(f"/api/v1/workers/{worker['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["state"] == "initialized"
    assert data["effective_state"] == "working"


@patch("app.routes.workers.k8s")
def test_get_worker_no_pod_marks_stopped(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()

    mock_k8s.get_worker_pod_status.return_value = None
    mock_k8s.get_pod_phase.return_value = (None, None)
    resp = client.get(f"/api/v1/workers/{worker['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["state"] == "stopped"
    assert data["pod_status"] == "missing"


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
def test_update_worker_ignores_mode_field(mock_k8s, client):
    """Mode is immutable. PATCH with `mode` succeeds but leaves the persisted mode untouched."""
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post(
        "/api/v1/workers", json={"task_id": task["id"], "mode": "ephemeral"}
    ).json()
    assert worker["mode"] == "ephemeral"

    resp = client.patch(f"/api/v1/workers/{worker['id']}", json={"mode": "stateful"})
    assert resp.status_code == 200
    assert resp.json()["mode"] == "ephemeral"


@patch("app.routes.workers.k8s")
def test_archive_worker_deletes_k8s_resources(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()

    resp = client.patch(f"/api/v1/workers/{worker['id']}", json={"state": "archived"})
    assert resp.status_code == 200
    assert resp.json()["state"] == "archived"
    mock_k8s.delete_worker_resources.assert_called_with(worker["id"], delete_pvc=False)


@patch("app.routes.workers.k8s")
def test_delete_worker(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()

    resp = client.delete(f"/api/v1/workers/{worker['id']}")
    assert resp.status_code == 204
    mock_k8s.delete_worker_resources.assert_called_with(worker["id"], delete_pvc=False)
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
    mock_task_k8s.delete_worker_resources.assert_called_with(worker["id"], delete_pvc=False)


@patch("app.routes.tasks.k8s")
def test_task_deletion_without_worker(mock_task_k8s, client):
    task = _create_task(client).json()
    resp = client.delete(f"/api/v1/tasks/{task['id']}")
    assert resp.status_code == 204
    mock_task_k8s.delete_worker_resources.assert_not_called()


@patch("app.routes.workers.k8s")
def test_create_worker_with_skills(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    resp = client.post(
        "/api/v1/workers",
        json={
            "task_id": task["id"],
            "skills": [
                {"name": "planner-daily-wrap-up", "version": "0.1.0"},
                {"name": "code-reviewer"},
            ],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["skills"]) == 2
    assert data["skills"][0]["name"] == "planner-daily-wrap-up"
    assert data["skills"][0]["version"] == "0.1.0"
    assert data["skills"][1]["name"] == "code-reviewer"
    assert data["skills"][1]["version"] == "latest"


@patch("app.routes.workers.k8s")
def test_create_worker_without_skills_defaults_empty(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    resp = client.post("/api/v1/workers", json={"task_id": task["id"]})
    assert resp.status_code == 201
    assert resp.json()["skills"] == []


@patch("app.routes.workers.k8s")
def test_create_worker_with_skills_passes_to_k8s(mock_k8s, client):
    mock_k8s.is_available.return_value = True
    task = _create_task(client).json()
    resp = client.post(
        "/api/v1/workers",
        json={
            "task_id": task["id"],
            "skills": [{"name": "planner-daily-wrap-up", "version": "0.1.0"}],
        },
    )
    assert resp.status_code == 201
    mock_k8s.create_worker_pod.assert_called_once()
    call_kwargs = mock_k8s.create_worker_pod.call_args
    assert call_kwargs.kwargs["skills"] == [{"name": "planner-daily-wrap-up", "version": "0.1.0"}]


# --- Stateful mode tests ---


@patch("app.routes.workers.k8s")
def test_create_worker_defaults_to_ephemeral(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    resp = client.post("/api/v1/workers", json={"task_id": task["id"]})
    assert resp.status_code == 201
    assert resp.json()["mode"] == "ephemeral"


@patch("app.routes.workers.k8s")
def test_create_stateful_worker_response_includes_mode(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    resp = client.post("/api/v1/workers", json={"task_id": task["id"], "mode": "stateful"})
    assert resp.status_code == 201
    assert resp.json()["mode"] == "stateful"


@patch("app.routes.workers.k8s")
def test_create_stateful_worker_provisions_pvc_and_passes_stateful_to_pod(mock_k8s, client):
    mock_k8s.is_available.return_value = True
    task = _create_task(client).json()
    resp = client.post("/api/v1/workers", json={"task_id": task["id"], "mode": "stateful"})
    assert resp.status_code == 201
    mock_k8s.create_worker_pvc.assert_called_once()
    mock_k8s.create_worker_pod.assert_called_once()
    assert mock_k8s.create_worker_pod.call_args.kwargs["stateful"] is True


@patch("app.routes.workers.k8s")
def test_create_ephemeral_worker_does_not_provision_pvc(mock_k8s, client):
    mock_k8s.is_available.return_value = True
    task = _create_task(client).json()
    resp = client.post("/api/v1/workers", json={"task_id": task["id"], "mode": "ephemeral"})
    assert resp.status_code == 201
    mock_k8s.create_worker_pvc.assert_not_called()
    assert mock_k8s.create_worker_pod.call_args.kwargs["stateful"] is False


@patch("app.routes.workers.k8s")
def test_stop_ephemeral_worker_returns_409(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()
    resp = client.post(f"/api/v1/workers/{worker['id']}/stop")
    assert resp.status_code == 409


@patch("app.routes.workers.k8s")
def test_stop_stateful_worker(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post(
        "/api/v1/workers", json={"task_id": task["id"], "mode": "stateful"}
    ).json()
    client.patch(f"/api/v1/workers/{worker['id']}", json={"state": "working"})

    resp = client.post(f"/api/v1/workers/{worker['id']}/stop")
    assert resp.status_code == 200
    assert resp.json()["state"] == "stopped"
    mock_k8s.delete_worker_pod_only.assert_called_once_with(worker["id"])
    mock_k8s.delete_worker_service.assert_called_once_with(worker["id"])
    mock_k8s.delete_worker_pvc.assert_not_called()


@patch("app.routes.workers.k8s")
def test_stop_is_idempotent_on_already_stopped(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post(
        "/api/v1/workers", json={"task_id": task["id"], "mode": "stateful"}
    ).json()
    client.patch(f"/api/v1/workers/{worker['id']}", json={"state": "working"})
    client.post(f"/api/v1/workers/{worker['id']}/stop")
    mock_k8s.reset_mock()

    resp = client.post(f"/api/v1/workers/{worker['id']}/stop")
    assert resp.status_code == 200
    assert resp.json()["state"] == "stopped"
    mock_k8s.delete_worker_pod_only.assert_not_called()
    mock_k8s.delete_worker_service.assert_not_called()


@patch("app.routes.workers.k8s")
def test_stop_archived_worker_returns_409(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post(
        "/api/v1/workers", json={"task_id": task["id"], "mode": "stateful"}
    ).json()
    client.patch(f"/api/v1/workers/{worker['id']}", json={"state": "archived"})
    resp = client.post(f"/api/v1/workers/{worker['id']}/stop")
    assert resp.status_code == 409


@patch("app.routes.workers.k8s")
def test_restart_ephemeral_worker_returns_409(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()
    resp = client.post(f"/api/v1/workers/{worker['id']}/restart")
    assert resp.status_code == 409


@patch("app.routes.workers.k8s")
def test_restart_archived_worker_returns_409(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post(
        "/api/v1/workers", json={"task_id": task["id"], "mode": "stateful"}
    ).json()
    client.patch(f"/api/v1/workers/{worker['id']}", json={"state": "archived"})
    resp = client.post(f"/api/v1/workers/{worker['id']}/restart")
    assert resp.status_code == 409


@patch("app.routes.workers.k8s")
def test_restart_stopped_worker_recreates_pod_and_service(mock_k8s, client):
    mock_k8s.is_available.return_value = True
    task = _create_task(client).json()
    worker = client.post(
        "/api/v1/workers", json={"task_id": task["id"], "mode": "stateful"}
    ).json()
    client.patch(f"/api/v1/workers/{worker['id']}", json={"state": "stopped"})
    mock_k8s.reset_mock()
    mock_k8s.is_available.return_value = True

    resp = client.post(f"/api/v1/workers/{worker['id']}/restart")
    assert resp.status_code == 200
    assert resp.json()["state"] == "initialized"
    mock_k8s.create_worker_pvc.assert_called_once()  # idempotent — re-uses existing PVC
    mock_k8s.create_worker_pod.assert_called_once()
    assert mock_k8s.create_worker_pod.call_args.kwargs["stateful"] is True
    mock_k8s.create_worker_service.assert_called_once_with(worker["id"])
    # Defensive deletion of any stale pod/service before creating fresh ones
    mock_k8s.delete_worker_pod_only.assert_called_once_with(worker["id"])
    mock_k8s.delete_worker_service.assert_called_once_with(worker["id"])


@patch("app.routes.workers.k8s")
def test_restart_errored_worker(mock_k8s, client):
    mock_k8s.is_available.return_value = True
    task = _create_task(client).json()
    worker = client.post(
        "/api/v1/workers", json={"task_id": task["id"], "mode": "stateful"}
    ).json()
    client.patch(f"/api/v1/workers/{worker['id']}", json={"state": "error"})
    mock_k8s.reset_mock()
    mock_k8s.is_available.return_value = True

    resp = client.post(f"/api/v1/workers/{worker['id']}/restart")
    assert resp.status_code == 200
    assert resp.json()["state"] == "initialized"


@patch("app.routes.workers.k8s")
def test_restart_running_worker_is_allowed(mock_k8s, client):
    mock_k8s.is_available.return_value = True
    task = _create_task(client).json()
    worker = client.post(
        "/api/v1/workers", json={"task_id": task["id"], "mode": "stateful"}
    ).json()
    client.patch(f"/api/v1/workers/{worker['id']}", json={"state": "working"})
    mock_k8s.reset_mock()
    mock_k8s.is_available.return_value = True

    resp = client.post(f"/api/v1/workers/{worker['id']}/restart")
    assert resp.status_code == 200
    assert resp.json()["state"] == "initialized"


@patch("app.routes.workers.k8s")
def test_archive_stateful_worker_deletes_pvc(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post(
        "/api/v1/workers", json={"task_id": task["id"], "mode": "stateful"}
    ).json()

    resp = client.patch(f"/api/v1/workers/{worker['id']}", json={"state": "archived"})
    assert resp.status_code == 200
    mock_k8s.delete_worker_resources.assert_called_with(worker["id"], delete_pvc=True)


@patch("app.routes.workers.k8s")
def test_delete_stateful_worker_deletes_pvc(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post(
        "/api/v1/workers", json={"task_id": task["id"], "mode": "stateful"}
    ).json()

    resp = client.delete(f"/api/v1/workers/{worker['id']}")
    assert resp.status_code == 204
    mock_k8s.delete_worker_resources.assert_called_with(worker["id"], delete_pvc=True)


@patch("app.routes.workers.k8s")
def test_get_worker_marks_failed_pod_as_error(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post(
        "/api/v1/workers", json={"task_id": task["id"], "mode": "stateful"}
    ).json()

    mock_k8s.get_worker_pod_status.return_value = None
    mock_k8s.get_pod_phase.return_value = ("Failed", 1)
    resp = client.get(f"/api/v1/workers/{worker['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["state"] == "error"
    assert data["effective_state"] == "error"
    assert data["pod_status"] == "failed"


# --- Terminal bridge integration (routes) ---


@patch("app.routes.workers.terminal_bridge")
@patch("app.routes.workers.k8s")
def test_worker_logs_endpoint(mock_k8s, mock_bridge, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()

    mock_k8s.read_pod_logs.return_value = "line1\nline2"
    resp = client.get(f"/api/v1/workers/{worker['id']}/logs?tail=100")
    assert resp.status_code == 200
    assert resp.text == "line1\nline2"
    assert resp.headers["content-type"].startswith("text/plain")
    mock_k8s.read_pod_logs.assert_called_once_with(worker["id"], tail_lines=100)


@patch("app.routes.workers.terminal_bridge")
@patch("app.routes.workers.k8s")
def test_worker_logs_404_without_pod(mock_k8s, mock_bridge, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()

    mock_k8s.read_pod_logs.return_value = None
    resp = client.get(f"/api/v1/workers/{worker['id']}/logs")
    assert resp.status_code == 404


@patch("app.routes.workers.k8s")
def test_worker_logs_404_unknown_worker(mock_k8s, client):
    resp = client.get("/api/v1/workers/doesnotexist/logs")
    assert resp.status_code == 404


@patch("app.routes.workers.terminal_bridge")
@patch("app.routes.workers.k8s")
def test_terminal_ws_rejects_unknown_worker(mock_k8s, mock_bridge, client):
    with client.websocket_connect("/api/v1/workers/doesnotexist/terminal") as ws:
        msg = ws.receive()
        assert msg["type"] == "websocket.close"
        assert msg["code"] == 1008


@patch("app.routes.workers.terminal_bridge")
@patch("app.routes.workers.k8s")
def test_terminal_ws_rejects_archived_worker(mock_k8s, mock_bridge, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()
    client.patch(f"/api/v1/workers/{worker['id']}", json={"state": "archived"})

    with client.websocket_connect(f"/api/v1/workers/{worker['id']}/terminal") as ws:
        msg = ws.receive()
        assert msg["type"] == "websocket.close"
        assert msg["code"] == 1008


@patch("app.routes.workers.terminal_bridge")
@patch("app.routes.workers.k8s")
def test_terminal_ws_delegates_to_bridge(mock_k8s, mock_bridge, client):
    from unittest.mock import AsyncMock

    mock_k8s.is_available.return_value = False
    mock_bridge.connect_terminal = AsyncMock()
    mock_bridge.connect_shell = AsyncMock()
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()

    with client.websocket_connect(f"/api/v1/workers/{worker['id']}/terminal"):
        pass
    mock_bridge.connect_terminal.assert_awaited_once()

    with client.websocket_connect(f"/api/v1/workers/{worker['id']}/shell"):
        pass
    mock_bridge.connect_shell.assert_awaited_once()


@patch("app.routes.workers.terminal_bridge")
@patch("app.routes.workers.k8s")
def test_stop_worker_cleans_up_bridge(mock_k8s, mock_bridge, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post(
        "/api/v1/workers", json={"task_id": task["id"], "mode": "stateful"}
    ).json()

    resp = client.post(f"/api/v1/workers/{worker['id']}/stop")
    assert resp.status_code == 200
    mock_bridge.cleanup.assert_called_once_with(worker["id"], status="stopped")


@patch("app.routes.workers.terminal_bridge")
@patch("app.routes.workers.k8s")
def test_delete_worker_cleans_up_bridge(mock_k8s, mock_bridge, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()

    resp = client.delete(f"/api/v1/workers/{worker['id']}")
    assert resp.status_code == 204
    mock_bridge.cleanup.assert_called_once_with(worker["id"], status="stopped")


@patch("app.routes.workers.terminal_bridge")
@patch("app.routes.workers.k8s")
def test_archive_worker_cleans_up_bridge(mock_k8s, mock_bridge, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()

    resp = client.patch(f"/api/v1/workers/{worker['id']}", json={"state": "archived"})
    assert resp.status_code == 200
    mock_bridge.cleanup.assert_called_once_with(worker["id"], status="stopped")


@patch("app.routes.workers.terminal_bridge")
@patch("app.routes.workers.k8s")
def test_create_worker_passes_task_prompt(mock_k8s, mock_bridge, client):
    mock_k8s.is_available.return_value = True
    task = _create_task(client, title="Fix the login bug").json()
    resp = client.post("/api/v1/workers", json={"task_id": task["id"]})
    assert resp.status_code == 201

    call = mock_k8s.create_worker_pod.call_args
    assert call.kwargs["task_prompt"] == "Work on the following task: Fix the login bug"
