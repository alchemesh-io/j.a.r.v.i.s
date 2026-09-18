import asyncio
import datetime
import logging
import os
import uuid

from croniter import croniter
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import SessionLocal
from app.models import ScheduledTask, Task, TaskNote, Worker
from app.models.enums import ScheduledTaskStatus, TaskStatus, WorkerMode, WorkerState
from app.services import k8s

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = int(os.getenv("SCHEDULED_TASK_POLL_INTERVAL_SECONDS", "60"))


def next_run_after(cron_expression: str, base: datetime.datetime) -> datetime.datetime:
    return croniter(cron_expression, base).get_next(datetime.datetime)


def fire_scheduled_task(db: Session, scheduled_task: ScheduledTask) -> dict:
    """Create a Task (+ note) and Worker from a schedule's definition, then advance
    last_run_at/next_run_at as if the schedule had fired.

    Worker-level session mode and CPU/memory overrides on the schedule aren't applied
    to the spawned worker yet — the Worker model doesn't support them. They're kept on
    ScheduledTask for forward compatibility with the API contract.
    """
    task = Task(title=scheduled_task.title, type=scheduled_task.task_type, status=TaskStatus.created)
    db.add(task)
    db.flush()

    if scheduled_task.note_content:
        db.add(TaskNote(task_id=task.id, content=scheduled_task.note_content))

    worker = Worker(
        id=uuid.uuid4().hex,
        task_id=task.id,
        type=scheduled_task.worker_type,
        mode=scheduled_task.worker_mode,
        state=WorkerState.initialized,
        skills=list(scheduled_task.skills or []),
    )
    worker.repositories = list(scheduled_task.repositories)
    db.add(worker)
    db.flush()
    db.refresh(worker)
    worker.task = task

    if k8s.is_available():
        from app.routes.workers import _provision_worker_pod  # local import: avoids a circular import at module load

        try:
            _provision_worker_pod(worker)
        except Exception:
            logger.exception("Failed to provision worker pod for scheduled task %s", scheduled_task.id)
            k8s.delete_worker_resources(worker.id, delete_pvc=worker.mode == WorkerMode.stateful)
            # Don't raise — the Task/Worker rows still exist so the run stays visible even if the pod failed.

    now = datetime.datetime.now(datetime.UTC)
    scheduled_task.last_run_at = now
    scheduled_task.next_run_at = (
        next_run_after(scheduled_task.cron_expression, now)
        if scheduled_task.status == ScheduledTaskStatus.active
        else None
    )
    db.flush()

    return {"task_id": task.id, "worker_id": worker.id}


def poll_due_scheduled_tasks() -> None:
    """DB-only, idempotent. Fires every active schedule whose next_run_at is due."""
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.UTC)
        due = db.scalars(
            select(ScheduledTask)
            .where(ScheduledTask.status == ScheduledTaskStatus.active)
            .where(ScheduledTask.next_run_at.isnot(None))
            .where(ScheduledTask.next_run_at <= now)
            .options(selectinload(ScheduledTask.repositories))
        ).all()
        for scheduled_task in due:
            try:
                fire_scheduled_task(db, scheduled_task)
                db.commit()
            except Exception:
                db.rollback()
                logger.exception("Failed to fire scheduled task %s", scheduled_task.id)
    finally:
        db.close()


async def run_scheduler_loop(stop_event: asyncio.Event) -> None:
    """Background loop: poll for due active schedules every POLL_INTERVAL_SECONDS."""
    while not stop_event.is_set():
        try:
            await asyncio.to_thread(poll_due_scheduled_tasks)
        except Exception:
            logger.exception("Scheduled task polling failed")
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=POLL_INTERVAL_SECONDS)
        except asyncio.TimeoutError:
            pass
