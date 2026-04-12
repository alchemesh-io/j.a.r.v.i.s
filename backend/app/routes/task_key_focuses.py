from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.key_focus import KeyFocus
from app.models.task import Task
from app.models.task_key_focus import TaskKeyFocus
from app.schemas.key_focus import KeyFocusResponse
from app.schemas.task_key_focus import TaskKeyFocusFromTask, TaskKeyFocusResponse

router = APIRouter(prefix="/tasks/{task_id}/key-focuses", tags=["task-key-focuses"])


def _get_task_or_404(db: Session, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("", response_model=list[KeyFocusResponse])
def list_task_key_focuses(task_id: int, db: Session = Depends(get_db)):
    _get_task_or_404(db, task_id)
    stmt = (
        select(KeyFocus)
        .join(TaskKeyFocus, TaskKeyFocus.key_focus_id == KeyFocus.id)
        .where(TaskKeyFocus.task_id == task_id)
        .options(
            selectinload(KeyFocus.tasks),
            selectinload(KeyFocus.blockers),
        )
    )
    key_focuses = db.scalars(stmt).unique().all()
    return [
        KeyFocusResponse(
            id=kf.id,
            title=kf.title,
            description=kf.description,
            kind=kf.kind,
            status=kf.status,
            frequency=kf.frequency,
            weekly_id=kf.weekly_id,
            task_count=len(kf.tasks),
            blocker_count=sum(1 for b in kf.blockers if b.status.value == "opened"),
        )
        for kf in key_focuses
    ]


@router.post("", response_model=TaskKeyFocusResponse, status_code=201)
def add_key_focus_to_task(
    task_id: int, body: TaskKeyFocusFromTask, db: Session = Depends(get_db)
):
    _get_task_or_404(db, task_id)
    kf = db.get(KeyFocus, body.key_focus_id)
    if not kf:
        raise HTTPException(status_code=404, detail="Key focus not found")
    existing = db.get(TaskKeyFocus, (task_id, body.key_focus_id))
    if existing:
        raise HTTPException(status_code=409, detail="Association already exists")
    assoc = TaskKeyFocus(task_id=task_id, key_focus_id=body.key_focus_id)
    db.add(assoc)
    db.flush()
    return assoc


@router.delete("/{key_focus_id}", status_code=204)
def remove_key_focus_from_task(
    task_id: int, key_focus_id: int, db: Session = Depends(get_db)
):
    assoc = db.get(TaskKeyFocus, (task_id, key_focus_id))
    if not assoc:
        raise HTTPException(status_code=404, detail="Association not found")
    db.delete(assoc)
