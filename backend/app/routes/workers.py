import logging
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, WebSocket
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import Repository, Task, Worker
from app.models.enums import WorkerMode, WorkerState
from app.schemas.worker import WorkerCreate, WorkerResponse, WorkerUpdate
from app.services import k8s
from app.services.terminal import bridge as terminal_bridge

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/workers", tags=["workers"])

WORKER_IMAGE = os.getenv("WORKER_IMAGE", "ghcr.io/alchemesh-io/jarvis-worker:latest")
WORKER_IMAGE_PULL_POLICY = os.getenv("WORKER_IMAGE_PULL_POLICY", "IfNotPresent")
KUBE_CONTEXT = os.getenv("KUBE_CONTEXT", "minikube")
WORKER_PVC_SIZE = os.getenv("WORKER_PVC_SIZE", "2Gi")
WORKER_PVC_STORAGE_CLASS = os.getenv("WORKER_PVC_STORAGE_CLASS", "standard")


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
        "mode": worker.mode,
        "state": worker.state,
        "effective_state": effective_state or worker.state,
        "pod_status": pod_status,
        "created_at": worker.created_at,
        "updated_at": worker.updated_at,
        "repositories": worker.repositories,
        "skills": worker.skills or [],
    }
    return WorkerResponse.model_validate(data)


def _build_task_prompt(task: Task | None) -> str:
    """Build the initial interactive prompt Claude Code receives on first boot."""
    if task is None:
        return ""
    parts = [f"Work on the following task: {task.title}"]
    notes = [n.content.strip() for n in (task.notes or []) if n.content and n.content.strip()]
    if notes:
        parts.append("")
        parts.append("Additional context / notes:")
        parts.extend(f"- {note}" for note in notes)
    return "\n".join(parts)


def _provision_worker_pod(worker: Worker) -> None:
    """(Re)create the K8s pod + service for a worker. PVC is created if stateful and absent."""
    if not k8s.is_available():
        return
    repo_data = [{"git_url": r.git_url, "branch": r.branch} for r in worker.repositories]
    skill_data = list(worker.skills or [])
    stateful = worker.mode == WorkerMode.stateful
    if stateful:
        k8s.create_worker_pvc(worker.id, WORKER_PVC_SIZE, WORKER_PVC_STORAGE_CLASS)
    k8s.create_worker_pod(
        worker.id,
        worker.task_id,
        WORKER_IMAGE,
        repo_data,
        skills=skill_data,
        image_pull_policy=WORKER_IMAGE_PULL_POLICY,
        stateful=stateful,
        task_prompt=_build_task_prompt(worker.task),
    )
    k8s.create_worker_service(worker.id)


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
        mode=body.mode,
        state=WorkerState.initialized,
        skills=[s.model_dump() for s in body.skills],
    )
    worker.repositories = list(repos)
    db.add(worker)
    db.flush()
    db.refresh(worker)

    if k8s.is_available():
        try:
            _provision_worker_pod(worker)
        except Exception:
            logger.exception("Failed to create K8s resources for worker %s", worker_id)
            # Roll back any partial K8s state so the operator isn't left with orphans.
            k8s.delete_worker_resources(worker_id, delete_pvc=worker.mode == WorkerMode.stateful)
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

    # Archived is fully terminal — never re-probe.
    if worker.state == WorkerState.archived:
        return _worker_to_response(worker)

    phase, exit_code = k8s.get_pod_phase(worker_id)

    if phase is None:
        # No pod exists. For stateful workers the PVC is still around — the worker is stopped.
        # For ephemeral workers the same is true (pod gone = nothing to do); we still call it stopped.
        if worker.state != WorkerState.stopped:
            worker.state = WorkerState.stopped
            db.flush()
        return _worker_to_response(worker, pod_status="missing")

    if phase == "Failed" or (exit_code is not None and exit_code != 0):
        if worker.state != WorkerState.error:
            worker.state = WorkerState.error
            db.flush()
        return _worker_to_response(worker, effective_state=WorkerState.error, pod_status="failed")

    if phase == "Succeeded":
        if worker.state != WorkerState.done:
            worker.state = WorkerState.done
            db.flush()
        return _worker_to_response(worker, effective_state=WorkerState.done, pod_status="succeeded")

    # Pod is Pending or Running — try the in-pod status server for finer-grained state.
    pod_status_data = k8s.get_worker_pod_status(worker_id)
    if pod_status_data:
        live_state_str = pod_status_data.get("state")
        try:
            effective = WorkerState(live_state_str)
        except ValueError:
            effective = worker.state
        return _worker_to_response(worker, effective_state=effective, pod_status=phase.lower())

    # Pod is up but status server hasn't started reporting yet (initial boot).
    return _worker_to_response(worker, pod_status=phase.lower())


@router.get("/{worker_id}/vscode-uri")
def get_worker_vscode_uri(worker_id: str, db: Session = Depends(get_db)):
    """Return a vscode:// URI to attach VSCode Dev Containers to this worker pod via Kubernetes."""
    _load_worker(db, worker_id)

    import json
    config = json.dumps({
        "context": KUBE_CONTEXT,
        "podname": f"jarvis-worker-{worker_id}",
        "namespace": k8s.NAMESPACE,
        "name": "worker",
    })
    hex_config = config.encode().hex()
    uri = f"vscode://vscode-remote/k8s-container+{hex_config}/home/node/jarvis"
    return {"uri": uri}


@router.get(
    "/{worker_id}/logs",
    response_class=PlainTextResponse,
    summary="Worker pod log tail",
    description="Returns the recent log tail of the worker container as plain text.",
)
def get_worker_logs(worker_id: str, tail: int = 500, db: Session = Depends(get_db)):
    _load_worker(db, worker_id)
    logs = k8s.read_pod_logs(worker_id, tail_lines=max(1, min(tail, 5000)))
    if logs is None:
        raise HTTPException(status_code=404, detail="Worker pod not found")
    return logs


async def _accept_worker_ws(ws: WebSocket, worker_id: str, db: Session) -> bool:
    """Accept the WS, then policy-check the worker. Closes with 1008 when invalid."""
    await ws.accept()
    worker = db.scalars(select(Worker).where(Worker.id == worker_id)).first()
    if not worker or worker.state == WorkerState.archived:
        await ws.close(code=1008, reason="Worker not found")
        return False
    return True


@router.websocket("/{worker_id}/terminal")
async def worker_terminal(ws: WebSocket, worker_id: str, db: Session = Depends(get_db)):
    """Attach to the worker's Claude Code PTY (shared, with scrollback replay)."""
    if await _accept_worker_ws(ws, worker_id, db):
        await terminal_bridge.connect_terminal(worker_id, ws)


@router.websocket("/{worker_id}/shell")
async def worker_shell(ws: WebSocket, worker_id: str, db: Session = Depends(get_db)):
    """Spawn an independent interactive shell in the worker container."""
    if await _accept_worker_ws(ws, worker_id, db):
        await terminal_bridge.connect_shell(worker_id, ws)


@router.patch("/{worker_id}", response_model=WorkerResponse)
def update_worker(worker_id: str, body: WorkerUpdate, db: Session = Depends(get_db)):
    worker = _load_worker(db, worker_id)

    if body.state is not None:
        if body.state == WorkerState.archived:
            terminal_bridge.cleanup(worker_id, status="stopped")
            k8s.delete_worker_resources(worker_id, delete_pvc=worker.mode == WorkerMode.stateful)
        worker.state = body.state

    db.flush()
    db.refresh(worker)
    return _worker_to_response(worker)


@router.post(
    "/{worker_id}/stop",
    response_model=WorkerResponse,
    summary="Stop a stateful worker",
    description=(
        "Deletes the worker pod and service while keeping the PVC and DB row. "
        "Only valid for stateful workers; ephemeral workers are rejected with HTTP 409. "
        "Idempotent: stopping an already-stopped worker is a no-op."
    ),
)
def stop_worker(worker_id: str, db: Session = Depends(get_db)):
    worker = _load_worker(db, worker_id)

    if worker.mode != WorkerMode.stateful:
        raise HTTPException(status_code=409, detail="Cannot stop an ephemeral worker")

    if worker.state == WorkerState.stopped:
        return _worker_to_response(worker)

    if worker.state == WorkerState.archived:
        raise HTTPException(status_code=409, detail="Cannot stop an archived worker")

    terminal_bridge.cleanup(worker_id, status="stopped")
    k8s.delete_worker_pod_only(worker_id)
    k8s.delete_worker_service(worker_id)

    worker.state = WorkerState.stopped
    db.flush()
    db.refresh(worker)
    return _worker_to_response(worker)


@router.post(
    "/{worker_id}/restart",
    response_model=WorkerResponse,
    summary="Restart a stateful worker",
    description=(
        "Re-creates the worker pod and service attached to the existing PVC. "
        "Valid for stateful workers in any state except 'archived'. "
        "If a pod already exists it is deleted first."
    ),
)
def restart_worker(worker_id: str, db: Session = Depends(get_db)):
    worker = _load_worker(db, worker_id)

    if worker.mode != WorkerMode.stateful:
        raise HTTPException(status_code=409, detail="Cannot restart an ephemeral worker")

    if worker.state == WorkerState.archived:
        raise HTTPException(status_code=409, detail="Cannot restart an archived worker")

    if k8s.is_available():
        # Drop any existing pod/service so the new pod cleanly attaches to the PVC.
        terminal_bridge.cleanup(worker_id, status="stopped")
        k8s.delete_worker_pod_only(worker_id)
        k8s.delete_worker_service(worker_id)
        try:
            _provision_worker_pod(worker)
        except Exception:
            logger.exception("Failed to restart worker %s", worker_id)
            raise HTTPException(status_code=503, detail="Failed to restart worker Kubernetes resources")

    worker.state = WorkerState.initialized
    db.flush()
    db.refresh(worker)
    return _worker_to_response(worker)


@router.delete("/{worker_id}", status_code=204)
def delete_worker(worker_id: str, db: Session = Depends(get_db)):
    worker = _load_worker(db, worker_id)
    terminal_bridge.cleanup(worker_id, status="stopped")
    k8s.delete_worker_resources(worker_id, delete_pvc=worker.mode == WorkerMode.stateful)
    db.delete(worker)
