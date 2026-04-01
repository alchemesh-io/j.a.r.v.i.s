import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import Daily, DailyTask
from app.schemas.daily import DailyCreate, DailyResponse

router = APIRouter(prefix="/dailies", tags=["dailies"])


@router.post("", response_model=DailyResponse, status_code=201)
def create_daily(body: DailyCreate, db: Session = Depends(get_db)):
    daily = Daily(date=body.date, weekly_id=body.weekly_id)
    db.add(daily)
    db.flush()
    db.refresh(daily)
    return daily


@router.get("/{daily_id}", response_model=DailyResponse)
def get_daily(daily_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(Daily)
        .where(Daily.id == daily_id)
        .options(selectinload(Daily.tasks).selectinload(DailyTask.task))
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
        .options(selectinload(Daily.tasks).selectinload(DailyTask.task))
    )
    daily = db.scalars(stmt).first()
    if not daily:
        raise HTTPException(status_code=404, detail="Daily not found for this date")
    return daily
