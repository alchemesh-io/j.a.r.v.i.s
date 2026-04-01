from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Daily, DailyTask, Task
from app.schemas.daily_task import DailyTaskCreate, DailyTaskReorder, DailyTaskResponse

router = APIRouter(prefix="/dailies/{daily_id}/tasks", tags=["daily-tasks"])


def _get_daily_or_404(daily_id: int, db: Session) -> Daily:
    daily = db.get(Daily, daily_id)
    if not daily:
        raise HTTPException(status_code=404, detail="Daily not found")
    return daily


@router.post("", response_model=DailyTaskResponse, status_code=201)
def add_task_to_daily(
    daily_id: int, body: DailyTaskCreate, db: Session = Depends(get_db)
):
    _get_daily_or_404(daily_id, db)
    task = db.get(Task, body.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    dt = DailyTask(daily_id=daily_id, task_id=body.task_id, priority=body.priority)
    db.add(dt)
    db.flush()
    db.refresh(dt)
    return dt


@router.delete("/{task_id}", status_code=204)
def remove_task_from_daily(
    daily_id: int, task_id: int, db: Session = Depends(get_db)
):
    _get_daily_or_404(daily_id, db)
    stmt = select(DailyTask).where(
        DailyTask.daily_id == daily_id, DailyTask.task_id == task_id
    )
    dt = db.scalars(stmt).first()
    if not dt:
        raise HTTPException(status_code=404, detail="Task not in this daily")
    db.delete(dt)


@router.put("/reorder", response_model=list[DailyTaskResponse])
def reorder_tasks(
    daily_id: int, body: DailyTaskReorder, db: Session = Depends(get_db)
):
    _get_daily_or_404(daily_id, db)

    # Clear existing priorities first to avoid unique constraint violations
    stmt = select(DailyTask).where(DailyTask.daily_id == daily_id)
    existing = {dt.task_id: dt for dt in db.scalars(stmt).all()}

    # Set all priorities to negative temporarily
    for dt in existing.values():
        dt.priority = -(dt.task_id + 1000)
    db.flush()

    # Now set the new priorities
    results = []
    for item in body.items:
        dt = existing.get(item.task_id)
        if not dt:
            raise HTTPException(
                status_code=404, detail=f"Task {item.task_id} not in this daily"
            )
        dt.priority = item.priority
        results.append(dt)
    db.flush()

    for dt in results:
        db.refresh(dt)
    return results
