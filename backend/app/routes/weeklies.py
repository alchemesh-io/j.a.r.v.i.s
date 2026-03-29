from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import Weekly
from app.schemas.weekly import WeeklyCreate, WeeklyResponse

router = APIRouter(prefix="/weeklies", tags=["weeklies"])


@router.post("", response_model=WeeklyResponse, status_code=201)
def create_weekly(body: WeeklyCreate, db: Session = Depends(get_db)):
    weekly = Weekly(week_start=body.week_start)
    db.add(weekly)
    db.flush()
    db.refresh(weekly)
    return weekly


@router.get("", response_model=list[WeeklyResponse])
def list_weeklies(db: Session = Depends(get_db)):
    stmt = select(Weekly).options(
        selectinload(Weekly.dailies)
    )
    return db.scalars(stmt).all()


@router.get("/{weekly_id}", response_model=WeeklyResponse)
def get_weekly(weekly_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(Weekly)
        .where(Weekly.id == weekly_id)
        .options(selectinload(Weekly.dailies))
    )
    weekly = db.scalars(stmt).first()
    if not weekly:
        raise HTTPException(status_code=404, detail="Weekly not found")
    return weekly
