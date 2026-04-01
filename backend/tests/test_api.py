import datetime


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["message"] == "J.A.R.V.I.S is online"


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# --- Tasks ---

def test_create_task(client):
    r = client.post("/api/v1/tasks", json={
        "title": "Test task",
        "type": "implementation",
    })
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Test task"
    assert data["type"] == "implementation"
    assert data["status"] == "created"
    assert data["id"] is not None


def test_create_task_with_jira(client):
    r = client.post("/api/v1/tasks", json={
        "title": "JIRA task",
        "type": "refinement",
        "jira_ticket_id": "JAR-42",
    })
    assert r.status_code == 201
    assert r.json()["jira_ticket_id"] == "JAR-42"


def test_create_task_invalid_type(client):
    r = client.post("/api/v1/tasks", json={
        "title": "Bad task",
        "type": "debugging",
    })
    assert r.status_code == 422


def test_list_tasks(client):
    client.post("/api/v1/tasks", json={"title": "T1", "type": "review"})
    client.post("/api/v1/tasks", json={"title": "T2", "type": "implementation"})
    r = client.get("/api/v1/tasks")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_get_task(client):
    cr = client.post("/api/v1/tasks", json={"title": "Find me", "type": "review"})
    task_id = cr.json()["id"]
    r = client.get(f"/api/v1/tasks/{task_id}")
    assert r.status_code == 200
    assert r.json()["title"] == "Find me"


def test_get_task_not_found(client):
    r = client.get("/api/v1/tasks/9999")
    assert r.status_code == 404


def test_update_task(client):
    cr = client.post("/api/v1/tasks", json={"title": "Old title", "type": "review"})
    task_id = cr.json()["id"]
    r = client.patch(f"/api/v1/tasks/{task_id}", json={"title": "New title", "status": "done"})
    assert r.status_code == 200
    assert r.json()["title"] == "New title"
    assert r.json()["status"] == "done"


def test_delete_task(client):
    cr = client.post("/api/v1/tasks", json={"title": "Delete me", "type": "review"})
    task_id = cr.json()["id"]
    r = client.delete(f"/api/v1/tasks/{task_id}")
    assert r.status_code == 204
    r2 = client.get(f"/api/v1/tasks/{task_id}")
    assert r2.status_code == 404


# --- Weeklies ---

def test_create_weekly(client):
    r = client.post("/api/v1/weeklies", json={"week_start": "2026-03-29"})
    assert r.status_code == 201
    assert r.json()["week_start"] == "2026-03-29"


def test_list_weeklies(client):
    client.post("/api/v1/weeklies", json={"week_start": "2026-03-29"})
    r = client.get("/api/v1/weeklies")
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_get_weekly(client):
    cr = client.post("/api/v1/weeklies", json={"week_start": "2026-03-29"})
    weekly_id = cr.json()["id"]
    r = client.get(f"/api/v1/weeklies/{weekly_id}")
    assert r.status_code == 200
    assert r.json()["week_start"] == "2026-03-29"


def test_get_weekly_not_found(client):
    r = client.get("/api/v1/weeklies/9999")
    assert r.status_code == 404


# --- Dailies ---

def test_create_daily(client):
    wr = client.post("/api/v1/weeklies", json={"week_start": "2026-03-29"})
    weekly_id = wr.json()["id"]
    r = client.post("/api/v1/dailies", json={
        "date": "2026-03-30",
        "weekly_id": weekly_id,
    })
    assert r.status_code == 201
    assert r.json()["date"] == "2026-03-30"


def test_get_daily_by_id(client):
    wr = client.post("/api/v1/weeklies", json={"week_start": "2026-03-29"})
    dr = client.post("/api/v1/dailies", json={
        "date": "2026-03-30",
        "weekly_id": wr.json()["id"],
    })
    daily_id = dr.json()["id"]
    r = client.get(f"/api/v1/dailies/{daily_id}")
    assert r.status_code == 200


def test_get_daily_by_date(client):
    wr = client.post("/api/v1/weeklies", json={"week_start": "2026-03-29"})
    client.post("/api/v1/dailies", json={
        "date": "2026-03-30",
        "weekly_id": wr.json()["id"],
    })
    r = client.get("/api/v1/dailies?date=2026-03-30")
    assert r.status_code == 200
    assert r.json()["date"] == "2026-03-30"


def test_get_daily_by_date_not_found(client):
    r = client.get("/api/v1/dailies?date=2099-01-01")
    assert r.status_code == 404


# --- Daily Tasks ---

def test_add_task_to_daily(client):
    wr = client.post("/api/v1/weeklies", json={"week_start": "2026-03-29"})
    dr = client.post("/api/v1/dailies", json={
        "date": "2026-03-30",
        "weekly_id": wr.json()["id"],
    })
    tr = client.post("/api/v1/tasks", json={"title": "Task", "type": "review"})
    daily_id = dr.json()["id"]
    task_id = tr.json()["id"]
    r = client.post(f"/api/v1/dailies/{daily_id}/tasks", json={
        "task_id": task_id,
        "priority": 1,
    })
    assert r.status_code == 201
    assert r.json()["priority"] == 1


def test_remove_task_from_daily(client):
    wr = client.post("/api/v1/weeklies", json={"week_start": "2026-03-29"})
    dr = client.post("/api/v1/dailies", json={
        "date": "2026-03-30",
        "weekly_id": wr.json()["id"],
    })
    tr = client.post("/api/v1/tasks", json={"title": "Task", "type": "review"})
    daily_id = dr.json()["id"]
    task_id = tr.json()["id"]
    client.post(f"/api/v1/dailies/{daily_id}/tasks", json={
        "task_id": task_id,
        "priority": 1,
    })
    r = client.delete(f"/api/v1/dailies/{daily_id}/tasks/{task_id}")
    assert r.status_code == 204


def test_reorder_tasks(client):
    wr = client.post("/api/v1/weeklies", json={"week_start": "2026-03-29"})
    dr = client.post("/api/v1/dailies", json={
        "date": "2026-03-30",
        "weekly_id": wr.json()["id"],
    })
    daily_id = dr.json()["id"]
    t1 = client.post("/api/v1/tasks", json={"title": "T1", "type": "review"}).json()
    t2 = client.post("/api/v1/tasks", json={"title": "T2", "type": "implementation"}).json()
    client.post(f"/api/v1/dailies/{daily_id}/tasks", json={"task_id": t1["id"], "priority": 1})
    client.post(f"/api/v1/dailies/{daily_id}/tasks", json={"task_id": t2["id"], "priority": 2})

    r = client.put(f"/api/v1/dailies/{daily_id}/tasks/reorder", json={
        "items": [
            {"task_id": t2["id"], "priority": 1},
            {"task_id": t1["id"], "priority": 2},
        ]
    })
    assert r.status_code == 200
    data = r.json()
    priorities = {item["task_id"]: item["priority"] for item in data}
    assert priorities[t2["id"]] == 1
    assert priorities[t1["id"]] == 2


# --- Filtering ---

def test_filter_tasks_daily_scope(client):
    wr = client.post("/api/v1/weeklies", json={"week_start": "2026-03-29"})
    dr = client.post("/api/v1/dailies", json={
        "date": "2026-03-30",
        "weekly_id": wr.json()["id"],
    })
    daily_id = dr.json()["id"]
    t1 = client.post("/api/v1/tasks", json={"title": "In daily", "type": "review"}).json()
    client.post("/api/v1/tasks", json={"title": "Not in daily", "type": "review"})
    client.post(f"/api/v1/dailies/{daily_id}/tasks", json={"task_id": t1["id"], "priority": 1})

    r = client.get("/api/v1/tasks?date=2026-03-30&scope=daily")
    assert r.status_code == 200
    titles = [t["title"] for t in r.json()]
    assert "In daily" in titles
    assert "Not in daily" not in titles


# --- Dates in response ---

def test_task_dates_empty_on_create(client):
    r = client.post("/api/v1/tasks", json={"title": "No dates", "type": "review"})
    assert r.status_code == 201
    assert r.json()["dates"] == []


def test_task_dates_after_association(client):
    wr = client.post("/api/v1/weeklies", json={"week_start": "2026-03-29"})
    d1 = client.post("/api/v1/dailies", json={
        "date": "2026-03-29",
        "weekly_id": wr.json()["id"],
    })
    d2 = client.post("/api/v1/dailies", json={
        "date": "2026-03-30",
        "weekly_id": wr.json()["id"],
    })
    tr = client.post("/api/v1/tasks", json={"title": "Multi-day", "type": "implementation"})
    task_id = tr.json()["id"]
    client.post(f"/api/v1/dailies/{d1.json()['id']}/tasks", json={"task_id": task_id, "priority": 1})
    client.post(f"/api/v1/dailies/{d2.json()['id']}/tasks", json={"task_id": task_id, "priority": 1})

    # Check via get by id
    r = client.get(f"/api/v1/tasks/{task_id}")
    assert r.json()["dates"] == ["2026-03-29", "2026-03-30"]

    # Check via list all
    r = client.get("/api/v1/tasks")
    task = next(t for t in r.json() if t["id"] == task_id)
    assert task["dates"] == ["2026-03-29", "2026-03-30"]

    # Check via daily scope filter
    r = client.get("/api/v1/tasks?date=2026-03-29&scope=daily")
    task = next(t for t in r.json() if t["id"] == task_id)
    assert task["dates"] == ["2026-03-29", "2026-03-30"]


def test_task_dates_after_removal(client):
    wr = client.post("/api/v1/weeklies", json={"week_start": "2026-03-29"})
    dr = client.post("/api/v1/dailies", json={
        "date": "2026-03-29",
        "weekly_id": wr.json()["id"],
    })
    tr = client.post("/api/v1/tasks", json={"title": "Remove me", "type": "review"})
    task_id = tr.json()["id"]
    daily_id = dr.json()["id"]
    client.post(f"/api/v1/dailies/{daily_id}/tasks", json={"task_id": task_id, "priority": 1})

    # Verify date present
    r = client.get(f"/api/v1/tasks/{task_id}")
    assert r.json()["dates"] == ["2026-03-29"]

    # Remove and verify gone
    client.delete(f"/api/v1/dailies/{daily_id}/tasks/{task_id}")
    r = client.get(f"/api/v1/tasks/{task_id}")
    assert r.json()["dates"] == []
