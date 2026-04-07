def _create_task(client, title="Test task"):
    r = client.post("/api/v1/tasks", json={"title": title, "type": "implementation"})
    assert r.status_code == 201
    return r.json()


def _create_note(client, task_id, content="## Meeting notes\nSome content"):
    r = client.post(f"/api/v1/tasks/{task_id}/notes", json={"content": content})
    assert r.status_code == 201
    return r.json()


# --- 3.1 CRUD operations ---


def test_create_note(client):
    task = _create_task(client)
    note = _create_note(client, task["id"])
    assert note["task_id"] == task["id"]
    assert note["content"] == "## Meeting notes\nSome content"
    assert note["id"] is not None
    assert note["created_at"] is not None
    assert note["updated_at"] is not None


def test_list_notes(client):
    task = _create_task(client)
    _create_note(client, task["id"], "Note 1")
    _create_note(client, task["id"], "Note 2")
    r = client.get(f"/api/v1/tasks/{task['id']}/notes")
    assert r.status_code == 200
    notes = r.json()
    assert len(notes) == 2
    contents = {n["content"] for n in notes}
    assert contents == {"Note 1", "Note 2"}


def test_list_notes_empty(client):
    task = _create_task(client)
    r = client.get(f"/api/v1/tasks/{task['id']}/notes")
    assert r.status_code == 200
    assert r.json() == []


def test_update_note(client):
    task = _create_task(client)
    note = _create_note(client, task["id"])
    r = client.patch(
        f"/api/v1/tasks/{task['id']}/notes/{note['id']}",
        json={"content": "Updated content"},
    )
    assert r.status_code == 200
    assert r.json()["content"] == "Updated content"


def test_delete_note(client):
    task = _create_task(client)
    note = _create_note(client, task["id"])
    r = client.delete(f"/api/v1/tasks/{task['id']}/notes/{note['id']}")
    assert r.status_code == 204
    # Verify gone
    r2 = client.get(f"/api/v1/tasks/{task['id']}/notes")
    assert len(r2.json()) == 0


# --- 3.2 Cascade deletion ---


def test_cascade_delete_task_deletes_notes(client):
    task = _create_task(client)
    _create_note(client, task["id"], "Note 1")
    _create_note(client, task["id"], "Note 2")
    r = client.delete(f"/api/v1/tasks/{task['id']}")
    assert r.status_code == 204
    # Task is gone, so notes endpoint returns 404
    r2 = client.get(f"/api/v1/tasks/{task['id']}/notes")
    assert r2.status_code == 404


# --- 3.3 Validation ---


def test_create_note_empty_content(client):
    task = _create_task(client)
    r = client.post(f"/api/v1/tasks/{task['id']}/notes", json={"content": ""})
    assert r.status_code == 422


def test_create_note_whitespace_content(client):
    task = _create_task(client)
    r = client.post(f"/api/v1/tasks/{task['id']}/notes", json={"content": "   "})
    assert r.status_code == 422


def test_create_note_nonexistent_task(client):
    r = client.post("/api/v1/tasks/9999/notes", json={"content": "Some content"})
    assert r.status_code == 404
    assert r.json()["detail"] == "Task not found"


def test_update_note_wrong_task(client):
    task1 = _create_task(client, "Task 1")
    task2 = _create_task(client, "Task 2")
    note = _create_note(client, task1["id"])
    # Try to access note via task2
    r = client.patch(
        f"/api/v1/tasks/{task2['id']}/notes/{note['id']}",
        json={"content": "Hacked"},
    )
    assert r.status_code == 404


def test_delete_note_wrong_task(client):
    task1 = _create_task(client, "Task 1")
    task2 = _create_task(client, "Task 2")
    note = _create_note(client, task1["id"])
    r = client.delete(f"/api/v1/tasks/{task2['id']}/notes/{note['id']}")
    assert r.status_code == 404


def test_note_count_in_task_response(client):
    task = _create_task(client)
    assert client.get(f"/api/v1/tasks/{task['id']}").json()["note_count"] == 0
    _create_note(client, task["id"], "Note 1")
    _create_note(client, task["id"], "Note 2")
    assert client.get(f"/api/v1/tasks/{task['id']}").json()["note_count"] == 2


def test_note_count_in_task_list(client):
    task = _create_task(client)
    _create_note(client, task["id"])
    tasks = client.get("/api/v1/tasks").json()
    t = next(t for t in tasks if t["id"] == task["id"])
    assert t["note_count"] == 1
