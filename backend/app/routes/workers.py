import logging
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import Repository, Task, Worker
from app.models.enums import WorkerState
from app.schemas.worker import WorkerCreate, WorkerResponse, WorkerUpdate
from app.services import k8s

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workers", tags=["workers"])

WORKER_IMAGE = os.getenv("WORKER_IMAGE", "ghcr.io/alchemesh-io/jarvis-worker:latest")
WORKER_IMAGE_PULL_POLICY = os.getenv("WORKER_IMAGE_PULL_POLICY", "IfNotPresent")


def _load_worker(db: Session, worker_id: str) -> Worker:
    stmt = (
        select(Worker)
        .where(Worker.id == worker_id)
        .options(selectinload(Worker.repositories))
    )
    worker = db.scalars(stmt).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    return worker


def _worker_to_response(worker: Worker, effective_state: WorkerState | None = None, pod_status: str | None = None) -> WorkerResponse:
    data = {
        "id": worker.id,
        "task_id": worker.task_id,
        "type": worker.type,
        "state": worker.state,
        "effective_state": effective_state or worker.state,
        "pod_status": pod_status,
        "created_at": worker.created_at,
        "updated_at": worker.updated_at,
        "repositories": worker.repositories,
    }
    return WorkerResponse.model_validate(data)


@router.post("", response_model=WorkerResponse, status_code=201)
def create_worker(body: WorkerCreate, db: Session = Depends(get_db)):
    existing = db.scalars(
        select(Worker).where(Worker.task_id == body.task_id)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Task already has a worker")

    task = db.get(Task, body.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    repos = []
    if body.repository_ids:
        repos = db.scalars(
            select(Repository).where(Repository.id.in_(body.repository_ids))
        ).all()
        if len(repos) != len(body.repository_ids):
            raise HTTPException(status_code=404, detail="One or more repositories not found")

    worker_id = uuid.uuid4().hex
    worker = Worker(
        id=worker_id,
        task_id=body.task_id,
        type=body.type,
        state=WorkerState.initialized,
    )
    worker.repositories = list(repos)
    db.add(worker)
    db.flush()
    db.refresh(worker)

    if k8s.is_available():
        try:
            repo_data = [{"git_url": r.git_url, "branch": r.branch} for r in repos]
            k8s.create_worker_pod(worker_id, body.task_id, WORKER_IMAGE, repo_data, image_pull_policy=WORKER_IMAGE_PULL_POLICY)
            k8s.create_worker_service(worker_id)
            k8s.create_worker_httproute(worker_id)
        except Exception:
            logger.exception("Failed to create K8s resources for worker %s", worker_id)
            raise HTTPException(status_code=503, detail="Failed to create worker Kubernetes resources")

    return _worker_to_response(worker)


@router.get("", response_model=list[WorkerResponse])
def list_workers(db: Session = Depends(get_db)):
    workers = db.scalars(
        select(Worker).options(selectinload(Worker.repositories))
    ).all()
    return [_worker_to_response(w) for w in workers]


@router.get("/{worker_id}", response_model=WorkerResponse)
def get_worker(worker_id: str, db: Session = Depends(get_db)):
    worker = _load_worker(db, worker_id)

    if worker.state in (WorkerState.archived, WorkerState.done):
        return _worker_to_response(worker)

    pod_status_data = k8s.get_worker_pod_status(worker_id)
    if pod_status_data:
        live_state_str = pod_status_data.get("state")
        try:
            effective = WorkerState(live_state_str)
        except ValueError:
            effective = worker.state
        return _worker_to_response(worker, effective_state=effective)

    return _worker_to_response(worker, pod_status="unreachable")


@router.get("/{worker_id}/vscode-uri")
def get_worker_vscode_uri(worker_id: str, db: Session = Depends(get_db)):
    """Return a vscode:// URI to attach VSCode Dev Containers to this worker pod."""
    _load_worker(db, worker_id)
    container_name = k8s.get_worker_container_name(worker_id)
    if not container_name:
        raise HTTPException(status_code=503, detail="Worker container not found or cluster unavailable")
    import json
    config = json.dumps({"containerName": f"/{container_name}"})
    hex_config = config.encode().hex()
    uri = f"vscode://vscode-remote/attached-container+{hex_config}/home/node/jarvis"
    return {"uri": uri}


@router.patch("/{worker_id}", response_model=WorkerResponse)
def update_worker(worker_id: str, body: WorkerUpdate, db: Session = Depends(get_db)):
    worker = _load_worker(db, worker_id)

    if body.state is not None:
        if body.state == WorkerState.archived:
            k8s.delete_worker_resources(worker_id)
        worker.state = body.state

    db.flush()
    db.refresh(worker)
    return _worker_to_response(worker)


@router.delete("/{worker_id}", status_code=204)
def delete_worker(worker_id: str, db: Session = Depends(get_db)):
    worker = _load_worker(db, worker_id)
    k8s.delete_worker_resources(worker_id)
    db.delete(worker)
