from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.blocker import Blocker
from app.models.task import Task
from app.schemas.blocker import BlockerResponse, NestedBlockerCreate

router = APIRouter(prefix="/tasks/{task_id}/blockers", tags=["task-blockers"])


def _get_task_or_404(db: Session, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("", response_model=list[BlockerResponse])
def list_task_blockers(task_id: int, db: Session = Depends(get_db)):
    _get_task_or_404(db, task_id)
    stmt = select(Blocker).where(Blocker.task_id == task_id)
    return db.scalars(stmt).all()


@router.post("", response_model=BlockerResponse, status_code=201)
def create_task_blocker(
    task_id: int, body: NestedBlockerCreate, db: Session = Depends(get_db)
):
    _get_task_or_404(db, task_id)
    blocker = Blocker(
        title=body.title,
        description=body.description,
        status=body.status,
        task_id=task_id,
    )
    db.add(blocker)
    db.flush()
    db.refresh(blocker)
    return blocker
