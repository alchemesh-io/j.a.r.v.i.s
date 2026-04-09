from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.blocker import Blocker
from app.models.enums import BlockerStatus
from app.schemas.blocker import BlockerCreate, BlockerResponse, BlockerUpdate

router = APIRouter(prefix="/blockers", tags=["blockers"])


def _load_blocker(db: Session, blocker_id: int) -> Blocker:
    blocker = db.get(Blocker, blocker_id)
    if not blocker:
        raise HTTPException(status_code=404, detail="Blocker not found")
    return blocker


@router.post("", response_model=BlockerResponse, status_code=201)
def create_blocker(body: BlockerCreate, db: Session = Depends(get_db)):
    blocker = Blocker(**body.model_dump())
    db.add(blocker)
    db.flush()
    db.refresh(blocker)
    return blocker


@router.get("", response_model=list[BlockerResponse])
def list_blockers(
    status: BlockerStatus | None = Query(None),
    db: Session = Depends(get_db),
):
    stmt = select(Blocker)
    if status is not None:
        stmt = stmt.where(Blocker.status == status)
    return db.scalars(stmt).all()


@router.get("/{blocker_id}", response_model=BlockerResponse)
def get_blocker(blocker_id: int, db: Session = Depends(get_db)):
    return _load_blocker(db, blocker_id)


@router.patch("/{blocker_id}", response_model=BlockerResponse)
def update_blocker(
    blocker_id: int, body: BlockerUpdate, db: Session = Depends(get_db)
):
    blocker = _load_blocker(db, blocker_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(blocker, field, value)
    db.flush()
    db.refresh(blocker)
    return blocker


@router.delete("/{blocker_id}", status_code=204)
def delete_blocker(blocker_id: int, db: Session = Depends(get_db)):
    blocker = _load_blocker(db, blocker_id)
    db.delete(blocker)
