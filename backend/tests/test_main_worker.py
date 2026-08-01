from unittest.mock import patch

import pytest

from app.db.engine import engine as _prod_engine
from app.models import Task
from app.models.enums import WorkerMode, WorkerState
from app.routes import workers
from app.services import main_brain


@pytest.fixture(autouse=True)
def _dispose_prod_engine_pool():
    """ensure_main_worker_pod opens its own SessionLocal() off the request path,
    so it isn't covered by the get_db override — it goes through the real,
    process-lifetime `app.db.engine.engine`. That engine pools connections
    across tests, so a stale pooled connection to this test's (about to be
    deleted) test.db file would corrupt the next test's fresh file unless
    disposed here, before the db_session fixture removes it."""
    yield
    _prod_engine.dispose()


def _create_task(client, title="Test task"):
    return client.post(
        "/api/v1/tasks",
        json={"title": title, "type": "implementation", "status": "created"},
    )


# --- Bootstrap: DB records ---


def test_client_fixture_does_not_run_lifespan(client):
    """Regression guard: if conftest.py ever switches to `with TestClient(app)`,
    lifespan (and thus main-worker bootstrap) would start running in every test.
    This documents the current (no-lifespan) behavior so that change fails loudly
    here instead of surfacing as a confusing off-by-one in unrelated tests."""
    resp = client.get("/api/v1/workers")
    assert resp.status_code == 200
    assert resp.json() == []


def test_ensure_main_brain_records_creates_task_and_worker(db_session):
    worker = workers.ensure_main_brain_records(db_session)

    assert worker.mode == WorkerMode.stateful
    assert worker.state == WorkerState.initialized
    assert worker.skills == []
    assert worker.repositories == []

    task = main_brain.get_main_task(db_session)
    assert task is not None
    assert task.id == worker.task_id
    assert task.source_id == main_brain.MAIN_BRAIN_SOURCE_ID
    assert task.source_type is None
    assert task.title == main_brain.MAIN_BRAIN_TITLE


def test_ensure_main_brain_records_is_idempotent(db_session):
    w1 = workers.ensure_main_brain_records(db_session)
    w2 = workers.ensure_main_brain_records(db_session)

    assert w1.id == w2.id
    tasks = db_session.query(Task).filter(
        Task.source_id == main_brain.MAIN_BRAIN_SOURCE_ID
    ).all()
    assert len(tasks) == 1


# --- Bootstrap: pod provisioning ---


@patch("app.routes.workers.k8s")
def test_ensure_main_worker_pod_provisions_when_missing(mock_k8s, db_session):
    mock_k8s.is_available.return_value = True
    mock_k8s.get_pod_phase.return_value = (None, None)
    worker = workers.ensure_main_brain_records(db_session)
    db_session.commit()

    workers.ensure_main_worker_pod(worker.id)

    mock_k8s.create_worker_pvc.assert_called_once()
    mock_k8s.create_worker_pod.assert_called_once()
    mock_k8s.create_worker_service.assert_called_once()
    assert mock_k8s.create_worker_pod.call_args.kwargs["task_prompt"] == ""

    db_session.expire_all()
    assert db_session.get(type(worker), worker.id).state == WorkerState.initialized


@patch("app.routes.workers.k8s")
def test_ensure_main_worker_pod_skips_when_already_running(mock_k8s, db_session):
    mock_k8s.is_available.return_value = True
    mock_k8s.get_pod_phase.return_value = ("Running", None)
    worker = workers.ensure_main_brain_records(db_session)
    db_session.commit()

    workers.ensure_main_worker_pod(worker.id)

    mock_k8s.create_worker_pod.assert_not_called()


@patch("app.routes.workers.k8s")
def test_ensure_main_worker_pod_skips_when_k8s_unavailable(mock_k8s, db_session):
    mock_k8s.is_available.return_value = False
    worker = workers.ensure_main_brain_records(db_session)
    db_session.commit()

    workers.ensure_main_worker_pod(worker.id)

    mock_k8s.get_pod_phase.assert_not_called()
    mock_k8s.create_worker_pod.assert_not_called()


@patch("app.routes.workers.k8s")
def test_ensure_main_worker_pod_failure_is_non_fatal(mock_k8s, db_session):
    mock_k8s.is_available.return_value = True
    mock_k8s.get_pod_phase.return_value = (None, None)
    mock_k8s.create_worker_pod.side_effect = RuntimeError("boom")
    worker = workers.ensure_main_brain_records(db_session)
    db_session.commit()

    workers.ensure_main_worker_pod(worker.id)  # must not raise

    db_session.expire_all()
    assert db_session.get(type(worker), worker.id).state == WorkerState.error


# --- GET /api/v1/workers/main ---


@patch("app.routes.workers.k8s")
def test_get_main_worker_route_404_before_bootstrap(mock_k8s, client):
    resp = client.get("/api/v1/workers/main")
    assert resp.status_code == 404


@patch("app.routes.workers.k8s")
def test_get_main_worker_route_returns_main_worker(mock_k8s, client, db_session):
    mock_k8s.is_available.return_value = False
    mock_k8s.get_pod_phase.return_value = (None, None)
    mock_k8s.get_worker_pod_status.return_value = None
    worker = workers.ensure_main_brain_records(db_session)
    db_session.commit()

    resp = client.get("/api/v1/workers/main")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == worker.id
    assert data["is_main"] is True
    assert data["mode"] == "stateful"


@patch("app.routes.workers.k8s")
def test_regular_worker_is_not_main(mock_k8s, client):
    mock_k8s.is_available.return_value = False
    task = _create_task(client).json()
    worker = client.post("/api/v1/workers", json={"task_id": task["id"]}).json()
    assert worker["is_main"] is False


# --- Guards ---


@patch("app.routes.workers.k8s")
def test_stop_main_worker_returns_409(mock_k8s, client, db_session):
    mock_k8s.is_available.return_value = False
    worker = workers.ensure_main_brain_records(db_session)
    db_session.commit()

    resp = client.post(f"/api/v1/workers/{worker.id}/stop")
    assert resp.status_code == 409


@patch("app.routes.workers.k8s")
def test_archive_main_worker_returns_409(mock_k8s, client, db_session):
    mock_k8s.is_available.return_value = False
    worker = workers.ensure_main_brain_records(db_session)
    db_session.commit()

    resp = client.patch(f"/api/v1/workers/{worker.id}", json={"state": "archived"})
    assert resp.status_code == 409
    mock_k8s.delete_worker_resources.assert_not_called()


@patch("app.routes.workers.k8s")
def test_delete_main_worker_returns_409(mock_k8s, client, db_session):
    mock_k8s.is_available.return_value = False
    mock_k8s.get_pod_phase.return_value = (None, None)
    worker = workers.ensure_main_brain_records(db_session)
    db_session.commit()

    resp = client.delete(f"/api/v1/workers/{worker.id}")
    assert resp.status_code == 409
    assert client.get(f"/api/v1/workers/{worker.id}").status_code == 200


@patch("app.routes.tasks.k8s")
@patch("app.routes.workers.k8s")
def test_delete_main_task_returns_409(mock_worker_k8s, mock_task_k8s, client, db_session):
    mock_worker_k8s.is_available.return_value = False
    worker = workers.ensure_main_brain_records(db_session)
    db_session.commit()

    resp = client.delete(f"/api/v1/tasks/{worker.task_id}")
    assert resp.status_code == 409
    mock_task_k8s.delete_worker_resources.assert_not_called()


@patch("app.routes.workers.k8s")
def test_restart_main_worker_still_allowed(mock_k8s, client, db_session):
    mock_k8s.is_available.return_value = True
    worker = workers.ensure_main_brain_records(db_session)
    db_session.commit()

    resp = client.post(f"/api/v1/workers/{worker.id}/restart")
    assert resp.status_code == 200
    mock_k8s.create_worker_pod.assert_called_once()


@patch("app.routes.workers.k8s")
def test_patch_main_worker_non_archived_state_still_allowed(mock_k8s, client, db_session):
    mock_k8s.is_available.return_value = False
    worker = workers.ensure_main_brain_records(db_session)
    db_session.commit()

    resp = client.patch(f"/api/v1/workers/{worker.id}", json={"state": "working"})
    assert resp.status_code == 200
    assert resp.json()["state"] == "working"


# --- Task listing filter ---


@patch("app.routes.workers.k8s")
def test_list_tasks_excludes_main_task_by_default(mock_k8s, client, db_session):
    mock_k8s.is_available.return_value = False
    _create_task(client, title="Normal task")
    workers.ensure_main_brain_records(db_session)
    db_session.commit()

    resp = client.get("/api/v1/tasks")
    assert resp.status_code == 200
    titles = [t["title"] for t in resp.json()]
    assert "Normal task" in titles
    assert main_brain.MAIN_BRAIN_TITLE not in titles


@patch("app.routes.workers.k8s")
def test_list_tasks_include_system_shows_main_task(mock_k8s, client, db_session):
    mock_k8s.is_available.return_value = False
    workers.ensure_main_brain_records(db_session)
    db_session.commit()

    resp = client.get("/api/v1/tasks?include_system=true")
    assert resp.status_code == 200
    titles = [t["title"] for t in resp.json()]
    assert main_brain.MAIN_BRAIN_TITLE in titles


@patch("app.routes.workers.k8s")
def test_list_tasks_null_source_id_still_returned(mock_k8s, client, db_session):
    """Regression guard: `source_id != X` alone is NULL (filtered out) for every
    row whose source_id is NULL under SQL three-valued logic — the filter must
    explicitly allow NULL through."""
    mock_k8s.is_available.return_value = False
    _create_task(client, title="Plain task, no source_id")
    workers.ensure_main_brain_records(db_session)
    db_session.commit()

    resp = client.get("/api/v1/tasks")
    assert resp.status_code == 200
    titles = [t["title"] for t in resp.json()]
    assert "Plain task, no source_id" in titles
