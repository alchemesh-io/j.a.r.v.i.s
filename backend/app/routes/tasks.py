import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

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


def _task_to_response(task: Task) -> TaskResponse:
    dates = sorted(entry.daily.date for entry in task.daily_entries)
    return TaskResponse(
        id=task.id,
        source_type=task.source_type,
        source_id=task.source_id,
        title=task.title,
        type=task.type,
        status=task.status,
        dates=dates,
    )


def _load_task(db: Session, task_id: int) -> Task:
    stmt = (
        select(Task)
        .where(Task.id == task_id)
        .options(selectinload(Task.daily_entries).selectinload(DailyTask.daily))
    )
    task = db.scalars(stmt).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("", response_model=TaskResponse, status_code=201)
def create_task(body: TaskCreate, db: Session = Depends(get_db)):
    task = Task(**body.model_dump())
    db.add(task)
    db.flush()
    db.refresh(task)
    return _task_to_response(task)


@router.get("", response_model=list[TaskResponse])
def list_tasks(
    date: datetime.date | None = Query(None),
    scope: str = Query("all", pattern="^(daily|weekly|all)$"),
    db: Session = Depends(get_db),
):
    if scope == "all" or date is None:
        stmt = select(Task).options(
            selectinload(Task.daily_entries).selectinload(DailyTask.daily)
        )
        tasks = db.scalars(stmt).all()
    else:
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
            .options(selectinload(Task.daily_entries).selectinload(DailyTask.daily))
        )
        tasks = db.scalars(stmt).unique().all()

    return [_task_to_response(t) for t in tasks]


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    return _task_to_response(_load_task(db, task_id))


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, body: TaskUpdate, db: Session = Depends(get_db)):
    task = _load_task(db, task_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.flush()
    db.refresh(task)
    return _task_to_response(task)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = _load_task(db, task_id)
    db.delete(task)
