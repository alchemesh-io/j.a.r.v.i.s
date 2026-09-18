import datetime

from croniter import croniter
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import Repository, ScheduledTask
from app.models.enums import ScheduledTaskStatus
from app.schemas.scheduled_task import (
    ScheduledTaskCreate,
    ScheduledTaskResponse,
    ScheduledTaskUpdate,
)
from app.services.scheduler import fire_scheduled_task, next_run_after

router = APIRouter(prefix="/scheduled-tasks", tags=["scheduled-tasks"])


def _validate_cron(expression: str) -> None:
    if not croniter.is_valid(expression):
        raise HTTPException(status_code=400, detail=f"Invalid cron expression: {expression!r}")


def _resolve_repositories(db: Session, repository_ids: list[int]) -> list[Repository]:
    if not repository_ids:
        return []
    repos = db.scalars(select(Repository).where(Repository.id.in_(repository_ids))).all()
    if len(repos) != len(set(repository_ids)):
        raise HTTPException(status_code=404, detail="One or more repositories not found")
    return repos


def _load_scheduled_task(db: Session, scheduled_task_id: int) -> ScheduledTask:
    stmt = (
        select(ScheduledTask)
        .where(ScheduledTask.id == scheduled_task_id)
        .options(selectinload(ScheduledTask.repositories))
    )
    scheduled_task = db.scalars(stmt).first()
    if not scheduled_task:
        raise HTTPException(status_code=404, detail="Scheduled task not found")
    return scheduled_task


@router.post("", response_model=ScheduledTaskResponse, status_code=201)
def create_scheduled_task(body: ScheduledTaskCreate, db: Session = Depends(get_db)):
    _validate_cron(body.cron_expression)
    repos = _resolve_repositories(db, body.repository_ids)

    now = datetime.datetime.now(datetime.UTC)
    scheduled_task = ScheduledTask(
        title=body.title,
        task_type=body.task_type,
        note_content=body.note_content,
        cron_expression=body.cron_expression,
        status=body.status,
        worker_type=body.worker_type,
        worker_mode=body.worker_mode,
        worker_session_mode=body.worker_session_mode,
        worker_cpu_request=body.worker_cpu_request,
        worker_memory_request=body.worker_memory_request,
        worker_cpu_limit=body.worker_cpu_limit,
        worker_memory_limit=body.worker_memory_limit,
        skills=[s.model_dump() for s in body.skills],
        next_run_at=next_run_after(body.cron_expression, now) if body.status == ScheduledTaskStatus.active else None,
    )
    scheduled_task.repositories = repos
    db.add(scheduled_task)
    db.flush()
    db.refresh(scheduled_task)
    return scheduled_task


@router.get("", response_model=list[ScheduledTaskResponse])
def list_scheduled_tasks(db: Session = Depends(get_db)):
    scheduled_tasks = db.scalars(
        select(ScheduledTask).options(selectinload(ScheduledTask.repositories))
    ).all()
    return scheduled_tasks


@router.get("/{scheduled_task_id}", response_model=ScheduledTaskResponse)
def get_scheduled_task(scheduled_task_id: int, db: Session = Depends(get_db)):
    return _load_scheduled_task(db, scheduled_task_id)


@router.patch("/{scheduled_task_id}", response_model=ScheduledTaskResponse)
def update_scheduled_task(scheduled_task_id: int, body: ScheduledTaskUpdate, db: Session = Depends(get_db)):
    scheduled_task = _load_scheduled_task(db, scheduled_task_id)
    data = body.model_dump(exclude_unset=True)

    if "cron_expression" in data:
        _validate_cron(data["cron_expression"])
    if "repository_ids" in data:
        scheduled_task.repositories = _resolve_repositories(db, data.pop("repository_ids"))

    for field, value in data.items():
        setattr(scheduled_task, field, value)

    if "cron_expression" in data or "status" in data:
        if scheduled_task.status == ScheduledTaskStatus.active:
            scheduled_task.next_run_at = next_run_after(scheduled_task.cron_expression, datetime.datetime.now(datetime.UTC))
        else:
            scheduled_task.next_run_at = None

    db.flush()
    db.refresh(scheduled_task)
    return scheduled_task


@router.delete("/{scheduled_task_id}", status_code=204)
def delete_scheduled_task(scheduled_task_id: int, db: Session = Depends(get_db)):
    scheduled_task = _load_scheduled_task(db, scheduled_task_id)
    db.delete(scheduled_task)


@router.post(
    "/{scheduled_task_id}/run",
    summary="Manually trigger a scheduled task now",
    description=(
        "Immediately creates a Task (+ note) and Worker from this schedule's definition, "
        "regardless of its cron schedule or active/paused status, then advances "
        "last_run_at/next_run_at as if the schedule had fired."
    ),
)
def run_scheduled_task_now(scheduled_task_id: int, db: Session = Depends(get_db)):
    scheduled_task = _load_scheduled_task(db, scheduled_task_id)
    result = fire_scheduled_task(db, scheduled_task)
    db.flush()
    return result
