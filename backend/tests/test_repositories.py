import uuid


def _create_repo(client, git_url="https://github.com/org/repo", branch="main"):
    return client.post("/api/v1/repositories", json={"git_url": git_url, "branch": branch})


def test_create_repository(client):
    resp = _create_repo(client)
    assert resp.status_code == 201
    data = resp.json()
    assert data["git_url"] == "https://github.com/org/repo"
    assert data["branch"] == "main"
    assert "id" in data


def test_create_repository_default_branch(client):
    resp = client.post("/api/v1/repositories", json={"git_url": "https://github.com/org/repo"})
    assert resp.status_code == 201
    assert resp.json()["branch"] == "main"


def test_create_repository_custom_branch(client):
    resp = _create_repo(client, branch="develop")
    assert resp.status_code == 201
    assert resp.json()["branch"] == "develop"


def test_create_duplicate_repository_returns_409(client):
    _create_repo(client)
    resp = _create_repo(client)
    assert resp.status_code == 409


def test_same_url_different_branches(client):
    resp1 = _create_repo(client, branch="main")
    resp2 = _create_repo(client, branch="develop")
    assert resp1.status_code == 201
    assert resp2.status_code == 201


def test_list_repositories(client):
    _create_repo(client, git_url="https://github.com/org/repo1")
    _create_repo(client, git_url="https://github.com/org/repo2")
    resp = client.get("/api/v1/repositories")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_list_repositories_empty(client):
    resp = client.get("/api/v1/repositories")
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_repository(client):
    create_resp = _create_repo(client)
    repo_id = create_resp.json()["id"]
    resp = client.get(f"/api/v1/repositories/{repo_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == repo_id


def test_get_nonexistent_repository(client):
    resp = client.get("/api/v1/repositories/9999")
    assert resp.status_code == 404


def test_delete_repository(client):
    create_resp = _create_repo(client)
    repo_id = create_resp.json()["id"]
    resp = client.delete(f"/api/v1/repositories/{repo_id}")
    assert resp.status_code == 204
    assert client.get(f"/api/v1/repositories/{repo_id}").status_code == 404


def test_delete_nonexistent_repository(client):
    resp = client.delete("/api/v1/repositories/9999")
    assert resp.status_code == 404


def test_delete_repository_in_use_by_active_worker(client, db_session):
    from app.models import Repository, Task, Worker
    from app.models.enums import TaskStatus, TaskType, WorkerState, WorkerType

    task = Task(title="Test", type=TaskType.implementation, status=TaskStatus.created)
    db_session.add(task)
    db_session.flush()

    repo = Repository(git_url="https://github.com/org/repo", branch="main")
    db_session.add(repo)
    db_session.flush()

    worker = Worker(
        id=uuid.uuid4().hex,
        task_id=task.id,
        type=WorkerType.claude_code,
        state=WorkerState.initialized,
    )
    worker.repositories = [repo]
    db_session.add(worker)
    db_session.commit()

    resp = client.delete(f"/api/v1/repositories/{repo.id}")
    assert resp.status_code == 409


def test_delete_repository_with_archived_worker(client, db_session):
    from app.models import Repository, Task, Worker
    from app.models.enums import TaskStatus, TaskType, WorkerState, WorkerType

    task = Task(title="Test", type=TaskType.implementation, status=TaskStatus.created)
    db_session.add(task)
    db_session.flush()

    repo = Repository(git_url="https://github.com/org/repo", branch="main")
    db_session.add(repo)
    db_session.flush()

    worker = Worker(
        id=uuid.uuid4().hex,
        task_id=task.id,
        type=WorkerType.claude_code,
        state=WorkerState.archived,
    )
    worker.repositories = [repo]
    db_session.add(worker)
    db_session.commit()

    resp = client.delete(f"/api/v1/repositories/{repo.id}")
    assert resp.status_code == 204
