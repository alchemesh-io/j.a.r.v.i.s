import datetime


def _create_weekly(client, week_start="2026-03-30"):
    r = client.post("/api/v1/weeklies", json={"week_start": week_start})
    assert r.status_code == 201
    return r.json()


def _create_key_focus(client, weekly_id, **overrides):
    body = {
        "title": "Deliver feature X",
        "kind": "delivery",
        "frequency": "weekly",
        "weekly_id": weekly_id,
    }
    body.update(overrides)
    r = client.post("/api/v1/key-focuses", json=body)
    assert r.status_code == 201
    return r.json()


def _create_task(client, title="Test task"):
    r = client.post("/api/v1/tasks", json={"title": title, "type": "implementation"})
    assert r.status_code == 201
    return r.json()


# --- 6.1 Key focus CRUD ---


def test_create_key_focus(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    assert kf["title"] == "Deliver feature X"
    assert kf["kind"] == "delivery"
    assert kf["status"] == "in_progress"
    assert kf["frequency"] == "weekly"
    assert kf["weekly_id"] == weekly["id"]
    assert kf["task_count"] == 0
    assert kf["blocker_count"] == 0


def test_create_key_focus_with_description(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"], description="Some details")
    assert kf["description"] == "Some details"


def test_create_key_focus_invalid_kind(client):
    weekly = _create_weekly(client)
    r = client.post(
        "/api/v1/key-focuses",
        json={
            "title": "Bad",
            "kind": "personal",
            "frequency": "weekly",
            "weekly_id": weekly["id"],
        },
    )
    assert r.status_code == 422


def test_list_key_focuses(client):
    weekly = _create_weekly(client)
    _create_key_focus(client, weekly["id"], title="KF1")
    _create_key_focus(client, weekly["id"], title="KF2")
    r = client.get("/api/v1/key-focuses")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_list_key_focuses_filter_weekly_id(client):
    w1 = _create_weekly(client, "2026-03-30")
    w2 = _create_weekly(client, "2026-04-06")
    _create_key_focus(client, w1["id"], title="KF1")
    _create_key_focus(client, w2["id"], title="KF2")
    r = client.get(f"/api/v1/key-focuses?weekly_id={w1['id']}")
    data = r.json()
    assert len(data) == 1
    assert data[0]["title"] == "KF1"


def test_list_key_focuses_filter_frequency(client):
    weekly = _create_weekly(client)
    _create_key_focus(client, weekly["id"], title="Weekly KF", frequency="weekly")
    _create_key_focus(client, weekly["id"], title="Quarterly KF", frequency="quarterly")
    r = client.get("/api/v1/key-focuses?frequency=quarterly")
    data = r.json()
    assert len(data) == 1
    assert data[0]["title"] == "Quarterly KF"


def test_get_key_focus(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    r = client.get(f"/api/v1/key-focuses/{kf['id']}")
    assert r.status_code == 200
    assert r.json()["title"] == "Deliver feature X"


def test_get_key_focus_not_found(client):
    r = client.get("/api/v1/key-focuses/999")
    assert r.status_code == 404


def test_update_key_focus(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    r = client.patch(
        f"/api/v1/key-focuses/{kf['id']}", json={"status": "succeed", "title": "Done!"}
    )
    assert r.status_code == 200
    assert r.json()["status"] == "succeed"
    assert r.json()["title"] == "Done!"


def test_delete_key_focus(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    r = client.delete(f"/api/v1/key-focuses/{kf['id']}")
    assert r.status_code == 204
    r = client.get(f"/api/v1/key-focuses/{kf['id']}")
    assert r.status_code == 404


# --- 6.2 Task-key focus association ---


def test_add_task_to_key_focus(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    task = _create_task(client)
    r = client.post(
        f"/api/v1/key-focuses/{kf['id']}/tasks", json={"task_id": task["id"]}
    )
    assert r.status_code == 201
    assert r.json()["task_id"] == task["id"]
    assert r.json()["key_focus_id"] == kf["id"]


def test_list_key_focus_tasks(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    t1 = _create_task(client, "Task 1")
    t2 = _create_task(client, "Task 2")
    client.post(f"/api/v1/key-focuses/{kf['id']}/tasks", json={"task_id": t1["id"]})
    client.post(f"/api/v1/key-focuses/{kf['id']}/tasks", json={"task_id": t2["id"]})
    r = client.get(f"/api/v1/key-focuses/{kf['id']}/tasks")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_remove_task_from_key_focus(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    task = _create_task(client)
    client.post(f"/api/v1/key-focuses/{kf['id']}/tasks", json={"task_id": task["id"]})
    r = client.delete(f"/api/v1/key-focuses/{kf['id']}/tasks/{task['id']}")
    assert r.status_code == 204


def test_add_task_to_nonexistent_key_focus(client):
    task = _create_task(client)
    r = client.post("/api/v1/key-focuses/999/tasks", json={"task_id": task["id"]})
    assert r.status_code == 404


def test_duplicate_association_rejected(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    task = _create_task(client)
    client.post(f"/api/v1/key-focuses/{kf['id']}/tasks", json={"task_id": task["id"]})
    r = client.post(
        f"/api/v1/key-focuses/{kf['id']}/tasks", json={"task_id": task["id"]}
    )
    assert r.status_code == 409


def test_key_focus_task_count(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    t1 = _create_task(client, "Task 1")
    t2 = _create_task(client, "Task 2")
    client.post(f"/api/v1/key-focuses/{kf['id']}/tasks", json={"task_id": t1["id"]})
    client.post(f"/api/v1/key-focuses/{kf['id']}/tasks", json={"task_id": t2["id"]})
    r = client.get(f"/api/v1/key-focuses/{kf['id']}")
    assert r.json()["task_count"] == 2


# --- 6.5 Key focus filtering by date/scope ---


def test_filter_key_focuses_by_weekly_scope(client):
    w1 = _create_weekly(client, "2026-03-30")
    w2 = _create_weekly(client, "2026-04-06")
    _create_key_focus(client, w1["id"], title="Week 1 KF")
    _create_key_focus(client, w2["id"], title="Week 2 KF")
    r = client.get("/api/v1/key-focuses?date=2026-04-01&scope=weekly")
    data = r.json()
    assert len(data) == 1
    assert data[0]["title"] == "Week 1 KF"


# --- 6.6 Task response includes key_focuses and blocker_count ---


def test_task_response_includes_key_focuses(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    task = _create_task(client)
    client.post(f"/api/v1/key-focuses/{kf['id']}/tasks", json={"task_id": task["id"]})
    r = client.get(f"/api/v1/tasks/{task['id']}")
    data = r.json()
    assert len(data["key_focuses"]) == 1
    assert data["key_focuses"][0]["id"] == kf["id"]
    assert data["key_focuses"][0]["kind"] == "delivery"


def test_task_response_includes_blocker_count(client):
    task = _create_task(client)
    client.post(
        f"/api/v1/tasks/{task['id']}/blockers", json={"title": "Blocked by X"}
    )
    client.post(
        f"/api/v1/tasks/{task['id']}/blockers", json={"title": "Blocked by Y"}
    )
    r = client.get(f"/api/v1/tasks/{task['id']}")
    assert r.json()["blocker_count"] == 2


def test_task_response_empty_key_focuses_and_blockers(client):
    task = _create_task(client)
    r = client.get(f"/api/v1/tasks/{task['id']}")
    assert r.json()["key_focuses"] == []
    assert r.json()["blocker_count"] == 0
