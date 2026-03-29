import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Daily, DailyTask, Task
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _get_week_bounds(date: datetime.date) -> tuple[datetime.date, datetime.date]:
    """Return (sunday, saturday) for the week containing `date`."""
    days_since_sunday = (date.weekday() + 1) % 7
    sunday = date - datetime.timedelta(days=days_since_sunday)
    saturday = sunday + datetime.timedelta(days=6)
    return sunday, saturday


@router.post("", response_model=TaskResponse, status_code=201)
def create_task(body: TaskCreate, db: Session = Depends(get_db)):
    task = Task(**body.model_dump())
    db.add(task)
    db.flush()
    db.refresh(task)
    return task


@router.get("", response_model=list[TaskResponse])
def list_tasks(
    date: datetime.date | None = Query(None),
    scope: str = Query("all", pattern="^(daily|weekly|all)$"),
    db: Session = Depends(get_db),
):
    if scope == "all" or date is None:
        return db.scalars(select(Task)).all()

    if scope == "daily":
        start, end = date, date
    else:
        start, end = _get_week_bounds(date)

    stmt = (
        select(Task)
        .join(DailyTask, DailyTask.task_id == Task.id)
        .join(Daily, Daily.id == DailyTask.daily_id)
        .where(Daily.date >= start, Daily.date <= end)
        .distinct()
    )
    return db.scalars(stmt).all()


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, body: TaskUpdate, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.flush()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
