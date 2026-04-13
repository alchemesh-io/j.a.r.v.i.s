import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Repository, Task, Worker, worker_repository
from app.models.enums import TaskStatus, TaskType, WorkerState, WorkerType


def _make_task(db_session, title="Test task") -> Task:
    t = Task(title=title, type=TaskType.implementation, status=TaskStatus.created)
    db_session.add(t)
    db_session.flush()
    return t


def _make_repo(db_session, git_url="https://github.com/org/repo", branch="main") -> Repository:
    r = Repository(git_url=git_url, branch=branch)
    db_session.add(r)
    db_session.flush()
    return r


def _make_worker(db_session, task: Task, repos: list[Repository] | None = None) -> Worker:
    w = Worker(
        id=uuid.uuid4().hex,
        task_id=task.id,
        type=WorkerType.claude_code,
        state=WorkerState.initialized,
    )
    if repos:
        w.repositories = repos
    db_session.add(w)
    db_session.flush()
    return w


# --- Repository model ---

def test_create_repository_default_branch(db_session):
    r = Repository(git_url="https://github.com/org/repo")
    db_session.add(r)
    db_session.commit()
    assert r.id is not None
    assert r.branch == "main"


def test_create_repository_custom_branch(db_session):
    r = Repository(git_url="https://github.com/org/repo", branch="develop")
    db_session.add(r)
    db_session.commit()
    assert r.branch == "develop"


def test_duplicate_git_url_branch_rejected(db_session):
    r1 = Repository(git_url="https://github.com/org/repo", branch="main")
    r2 = Repository(git_url="https://github.com/org/repo", branch="main")
    db_session.add(r1)
    db_session.commit()
    db_session.add(r2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_same_url_different_branches_allowed(db_session):
    r1 = Repository(git_url="https://github.com/org/repo", branch="main")
    r2 = Repository(git_url="https://github.com/org/repo", branch="develop")
    db_session.add_all([r1, r2])
    db_session.commit()
    assert r1.id != r2.id


# --- Worker model ---

def test_create_worker(db_session):
    task = _make_task(db_session)
    worker = _make_worker(db_session, task)
    db_session.commit()
    assert len(worker.id) == 32
    assert worker.task_id == task.id
    assert worker.state == WorkerState.initialized
    assert worker.type == WorkerType.claude_code


def test_one_worker_per_task(db_session):
    task = _make_task(db_session)
    _make_worker(db_session, task)
    db_session.commit()

    w2 = Worker(
        id=uuid.uuid4().hex,
        task_id=task.id,
        type=WorkerType.claude_code,
        state=WorkerState.initialized,
    )
    db_session.add(w2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_worker_references_multiple_repositories(db_session):
    task = _make_task(db_session)
    r1 = _make_repo(db_session, "https://github.com/org/repo1")
    r2 = _make_repo(db_session, "https://github.com/org/repo2")
    r3 = _make_repo(db_session, "https://github.com/org/repo3")
    worker = _make_worker(db_session, task, repos=[r1, r2, r3])
    db_session.commit()
    db_session.refresh(worker)
    assert len(worker.repositories) == 3


def test_task_worker_relationship(db_session):
    task = _make_task(db_session)
    worker = _make_worker(db_session, task)
    db_session.commit()
    db_session.refresh(task)
    assert task.worker is not None
    assert task.worker.id == worker.id


def test_task_without_worker(db_session):
    task = _make_task(db_session)
    db_session.commit()
    db_session.refresh(task)
    assert task.worker is None


# --- Cascade deletes ---

def test_worker_deletion_cascades_to_associations(db_session):
    task = _make_task(db_session)
    repo = _make_repo(db_session)
    worker = _make_worker(db_session, task, repos=[repo])
    db_session.commit()
    worker_id = worker.id

    db_session.delete(worker)
    db_session.commit()

    rows = db_session.execute(
        worker_repository.select().where(worker_repository.c.worker_id == worker_id)
    ).all()
    assert len(rows) == 0


def test_task_deletion_cascades_to_worker(db_session):
    task = _make_task(db_session)
    worker = _make_worker(db_session, task)
    db_session.commit()
    worker_id = worker.id

    db_session.delete(task)
    db_session.commit()

    assert db_session.get(Worker, worker_id) is None


def test_repository_deletion_cascades_to_associations(db_session):
    task = _make_task(db_session)
    repo = _make_repo(db_session)
    _make_worker(db_session, task, repos=[repo])
    db_session.commit()
    repo_id = repo.id

    db_session.delete(repo)
    db_session.commit()

    rows = db_session.execute(
        worker_repository.select().where(worker_repository.c.repository_id == repo_id)
    ).all()
    assert len(rows) == 0


# --- Enum values ---

def test_worker_state_enum_values():
    assert WorkerState.initialized.value == "initialized"
    assert WorkerState.working.value == "working"
    assert WorkerState.waiting_for_human.value == "waiting_for_human"
    assert WorkerState.done.value == "done"
    assert WorkerState.archived.value == "archived"


def test_worker_type_enum_values():
    assert WorkerType.claude_code.value == "claude_code"
