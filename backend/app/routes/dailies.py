import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import Daily, DailyTask, Task
from app.schemas.daily import DailyCreate, DailyResponse

router = APIRouter(prefix="/dailies", tags=["dailies"])


@router.post("", response_model=DailyResponse, status_code=201)
def create_daily(body: DailyCreate, db: Session = Depends(get_db)):
    daily = Daily(date=body.date, weekly_id=body.weekly_id)
    db.add(daily)
    db.flush()
    db.refresh(daily)
    return daily


def _daily_load_options():
    """Eagerly load task relationships so DailyTaskResponse includes full task data."""
    task_load = selectinload(Daily.tasks).selectinload(DailyTask.task)
    return [
        task_load.selectinload(Task.notes),
        task_load.selectinload(Task.daily_entries).selectinload(DailyTask.daily),
        task_load.selectinload(Task.key_focuses),
        task_load.selectinload(Task.blockers),
    ]


@router.get("/{daily_id}", response_model=DailyResponse)
def get_daily(daily_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(Daily)
        .where(Daily.id == daily_id)
        .options(*_daily_load_options())
    )
    daily = db.scalars(stmt).first()
    if not daily:
        raise HTTPException(status_code=404, detail="Daily not found")
    return daily


@router.get("", response_model=DailyResponse)
def get_daily_by_date(
    date: datetime.date = Query(...),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Daily)
        .where(Daily.date == date)
        .options(*_daily_load_options())
    )
    daily = db.scalars(stmt).first()
    if not daily:
        raise HTTPException(status_code=404, detail="Daily not found for this date")
    return daily
