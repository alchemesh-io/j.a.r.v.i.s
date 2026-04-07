def _create_task(client, title="Test task"):
    r = client.post("/api/v1/tasks", json={"title": title, "type": "implementation"})
    assert r.status_code == 201
    return r.json()


def _create_weekly(client, week_start="2026-03-30"):
    r = client.post("/api/v1/weeklies", json={"week_start": week_start})
    assert r.status_code == 201
    return r.json()


def _create_key_focus(client, weekly_id):
    r = client.post(
        "/api/v1/key-focuses",
        json={
            "title": "KF",
            "kind": "delivery",
            "frequency": "weekly",
            "weekly_id": weekly_id,
        },
    )
    assert r.status_code == 201
    return r.json()


# --- 6.3 Blocker CRUD with XOR validation ---


def test_create_blocker_for_task(client):
    task = _create_task(client)
    r = client.post(
        "/api/v1/blockers",
        json={"title": "Blocked", "task_id": task["id"]},
    )
    assert r.status_code == 201
    assert r.json()["task_id"] == task["id"]
    assert r.json()["key_focus_id"] is None
    assert r.json()["status"] == "opened"


def test_create_blocker_for_key_focus(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    r = client.post(
        "/api/v1/blockers",
        json={"title": "Blocked", "key_focus_id": kf["id"]},
    )
    assert r.status_code == 201
    assert r.json()["key_focus_id"] == kf["id"]
    assert r.json()["task_id"] is None


def test_create_blocker_both_references_rejected(client):
    task = _create_task(client)
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    r = client.post(
        "/api/v1/blockers",
        json={"title": "Bad", "task_id": task["id"], "key_focus_id": kf["id"]},
    )
    assert r.status_code == 422


def test_create_blocker_no_reference_rejected(client):
    r = client.post("/api/v1/blockers", json={"title": "Bad"})
    assert r.status_code == 422


def test_list_blockers(client):
    task = _create_task(client)
    client.post("/api/v1/blockers", json={"title": "B1", "task_id": task["id"]})
    client.post("/api/v1/blockers", json={"title": "B2", "task_id": task["id"]})
    r = client.get("/api/v1/blockers")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_list_blockers_filter_status(client):
    task = _create_task(client)
    b = client.post(
        "/api/v1/blockers", json={"title": "B1", "task_id": task["id"]}
    ).json()
    client.post("/api/v1/blockers", json={"title": "B2", "task_id": task["id"]})
    client.patch(f"/api/v1/blockers/{b['id']}", json={"status": "resolved"})
    r = client.get("/api/v1/blockers?status=opened")
    assert len(r.json()) == 1
    r = client.get("/api/v1/blockers?status=resolved")
    assert len(r.json()) == 1


def test_get_blocker(client):
    task = _create_task(client)
    b = client.post(
        "/api/v1/blockers", json={"title": "B1", "task_id": task["id"]}
    ).json()
    r = client.get(f"/api/v1/blockers/{b['id']}")
    assert r.status_code == 200
    assert r.json()["title"] == "B1"


def test_update_blocker(client):
    task = _create_task(client)
    b = client.post(
        "/api/v1/blockers", json={"title": "B1", "task_id": task["id"]}
    ).json()
    r = client.patch(f"/api/v1/blockers/{b['id']}", json={"status": "resolved"})
    assert r.status_code == 200
    assert r.json()["status"] == "resolved"


def test_delete_blocker(client):
    task = _create_task(client)
    b = client.post(
        "/api/v1/blockers", json={"title": "B1", "task_id": task["id"]}
    ).json()
    r = client.delete(f"/api/v1/blockers/{b['id']}")
    assert r.status_code == 204


# --- 6.4 Nested blocker endpoints on tasks and key focuses ---


def test_list_task_blockers(client):
    task = _create_task(client)
    client.post(f"/api/v1/tasks/{task['id']}/blockers", json={"title": "TB1"})
    client.post(f"/api/v1/tasks/{task['id']}/blockers", json={"title": "TB2"})
    r = client.get(f"/api/v1/tasks/{task['id']}/blockers")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_create_task_blocker(client):
    task = _create_task(client)
    r = client.post(f"/api/v1/tasks/{task['id']}/blockers", json={"title": "TB1"})
    assert r.status_code == 201
    assert r.json()["task_id"] == task["id"]


def test_list_key_focus_blockers(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    client.post(f"/api/v1/key-focuses/{kf['id']}/blockers", json={"title": "KFB1"})
    r = client.get(f"/api/v1/key-focuses/{kf['id']}/blockers")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_create_key_focus_blocker(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    r = client.post(f"/api/v1/key-focuses/{kf['id']}/blockers", json={"title": "KFB1"})
    assert r.status_code == 201
    assert r.json()["key_focus_id"] == kf["id"]


def test_key_focus_blocker_count(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    client.post(f"/api/v1/key-focuses/{kf['id']}/blockers", json={"title": "KFB1"})
    client.post(f"/api/v1/key-focuses/{kf['id']}/blockers", json={"title": "KFB2"})
    r = client.get(f"/api/v1/key-focuses/{kf['id']}")
    assert r.json()["blocker_count"] == 2


def test_cascade_delete_task_deletes_blockers(client):
    task = _create_task(client)
    client.post(f"/api/v1/tasks/{task['id']}/blockers", json={"title": "TB1"})
    client.delete(f"/api/v1/tasks/{task['id']}")
    r = client.get("/api/v1/blockers")
    assert len(r.json()) == 0


def test_cascade_delete_key_focus_deletes_blockers(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    client.post(f"/api/v1/key-focuses/{kf['id']}/blockers", json={"title": "KFB1"})
    client.delete(f"/api/v1/key-focuses/{kf['id']}")
    r = client.get("/api/v1/blockers")
    assert len(r.json()) == 0


# --- Task key focus management from task side ---


def test_list_task_key_focuses(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    task = _create_task(client)
    client.post(f"/api/v1/tasks/{task['id']}/key-focuses", json={"key_focus_id": kf["id"]})
    r = client.get(f"/api/v1/tasks/{task['id']}/key-focuses")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_add_key_focus_to_task(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    task = _create_task(client)
    r = client.post(
        f"/api/v1/tasks/{task['id']}/key-focuses", json={"key_focus_id": kf["id"]}
    )
    assert r.status_code == 201


def test_remove_key_focus_from_task(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    task = _create_task(client)
    client.post(
        f"/api/v1/tasks/{task['id']}/key-focuses", json={"key_focus_id": kf["id"]}
    )
    r = client.delete(f"/api/v1/tasks/{task['id']}/key-focuses/{kf['id']}")
    assert r.status_code == 204
