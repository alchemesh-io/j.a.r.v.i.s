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


def _create_opportunity(client, **overrides):
    body = {"title": "Improve AI area"}
    body.update(overrides)
    r = client.post("/api/v1/opportunities", json=body)
    assert r.status_code == 201
    return r.json()


# --- Opportunity CRUD ---


def test_create_opportunity(client):
    opp = _create_opportunity(client, description="Grow the AI capabilities")
    assert opp["title"] == "Improve AI area"
    assert opp["description"] == "Grow the AI capabilities"
    assert opp["key_focus_count"] == 0
    assert opp["task_count"] == 0


def test_get_opportunity(client):
    created = _create_opportunity(client)
    r = client.get(f"/api/v1/opportunities/{created['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == created["id"]


def test_get_opportunity_not_found(client):
    r = client.get("/api/v1/opportunities/999")
    assert r.status_code == 404


def test_list_opportunities(client):
    _create_opportunity(client, title="Opp 1")
    _create_opportunity(client, title="Opp 2")
    r = client.get("/api/v1/opportunities")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_update_opportunity(client):
    opp = _create_opportunity(client)
    r = client.patch(f"/api/v1/opportunities/{opp['id']}", json={"title": "Renamed"})
    assert r.status_code == 200
    assert r.json()["title"] == "Renamed"


def test_delete_opportunity(client):
    opp = _create_opportunity(client)
    r = client.delete(f"/api/v1/opportunities/{opp['id']}")
    assert r.status_code == 204
    r = client.get(f"/api/v1/opportunities/{opp['id']}")
    assert r.status_code == 404


# --- Key focus association ---


def test_add_key_focus_to_opportunity(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    opp = _create_opportunity(client)

    r = client.post(
        f"/api/v1/opportunities/{opp['id']}/key-focuses",
        json={"key_focus_id": kf["id"]},
    )
    assert r.status_code == 201

    r = client.get(f"/api/v1/opportunities/{opp['id']}")
    assert r.json()["key_focus_count"] == 1
    assert r.json()["key_focus_ids"] == [kf["id"]]


def test_add_key_focus_to_opportunity_duplicate(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    opp = _create_opportunity(client)
    client.post(f"/api/v1/opportunities/{opp['id']}/key-focuses", json={"key_focus_id": kf["id"]})

    r = client.post(
        f"/api/v1/opportunities/{opp['id']}/key-focuses",
        json={"key_focus_id": kf["id"]},
    )
    assert r.status_code == 409


def test_add_key_focus_to_opportunity_missing_key_focus(client):
    opp = _create_opportunity(client)
    r = client.post(f"/api/v1/opportunities/{opp['id']}/key-focuses", json={"key_focus_id": 999})
    assert r.status_code == 404


def test_opportunity_task_count_via_key_focus(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    task = _create_task(client)
    client.post(f"/api/v1/key-focuses/{kf['id']}/tasks", json={"task_id": task["id"]})
    opp = _create_opportunity(client)
    client.post(f"/api/v1/opportunities/{opp['id']}/key-focuses", json={"key_focus_id": kf["id"]})

    r = client.get(f"/api/v1/opportunities/{opp['id']}")
    assert r.json()["task_count"] == 1


def test_list_opportunity_key_focuses(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"], title="KF1")
    opp = _create_opportunity(client)
    client.post(f"/api/v1/opportunities/{opp['id']}/key-focuses", json={"key_focus_id": kf["id"]})

    r = client.get(f"/api/v1/opportunities/{opp['id']}/key-focuses")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["id"] == kf["id"]


def test_remove_key_focus_from_opportunity(client):
    weekly = _create_weekly(client)
    kf = _create_key_focus(client, weekly["id"])
    opp = _create_opportunity(client)
    client.post(f"/api/v1/opportunities/{opp['id']}/key-focuses", json={"key_focus_id": kf["id"]})

    r = client.delete(f"/api/v1/opportunities/{opp['id']}/key-focuses/{kf['id']}")
    assert r.status_code == 204

    r = client.get(f"/api/v1/opportunities/{opp['id']}")
    assert r.json()["key_focus_count"] == 0


def test_remove_key_focus_from_opportunity_not_found(client):
    opp = _create_opportunity(client)
    r = client.delete(f"/api/v1/opportunities/{opp['id']}/key-focuses/999")
    assert r.status_code == 404
