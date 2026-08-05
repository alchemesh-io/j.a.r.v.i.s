"""Identity helpers for the permanent, PVC-backed "main brain" worker.

Modeled as a synthetic, permanent Task (via the existing one-to-one
Worker<->Task relationship) rather than a schema change: Task.source_id is a
free-text, non-enum-constrained column, so a well-known marker string here
requires no migration.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Task, TaskType, Worker

MAIN_BRAIN_SOURCE_ID = "jarvis-main-brain"
MAIN_BRAIN_TITLE = "J.A.R.V.I.S Main Brain"
MAIN_BRAIN_TASK_TYPE = TaskType.implementation  # cosmetic only — task is hidden from task UIs


def get_main_task(db: Session) -> Task | None:
    return db.scalars(
        select(Task).where(Task.source_id == MAIN_BRAIN_SOURCE_ID)
    ).first()


def get_main_worker(db: Session) -> Worker | None:
    return db.scalars(
        select(Worker).join(Task, Worker.task_id == Task.id).where(
            Task.source_id == MAIN_BRAIN_SOURCE_ID
        )
    ).first()


def is_main_task(task: Task | None) -> bool:
    return task is not None and task.source_id == MAIN_BRAIN_SOURCE_ID


def is_main_worker(worker: Worker | None) -> bool:
    return worker is not None and is_main_task(worker.task)
