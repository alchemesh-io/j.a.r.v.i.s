import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.blocker import Blocker
from app.models.key_focus import KeyFocus
from app.models.task import Task
from app.models.task_key_focus import TaskKeyFocus
from app.models.weekly import Weekly
from app.schemas.blocker import BlockerResponse, NestedBlockerCreate
from app.schemas.key_focus import KeyFocusCreate, KeyFocusResponse, KeyFocusUpdate
from app.schemas.task_key_focus import TaskKeyFocusCreate, TaskKeyFocusResponse

router = APIRouter(prefix="/key-focuses", tags=["key-focuses"])


def _get_week_bounds(date: datetime.date) -> tuple[datetime.date, datetime.date]:
    days_since_sunday = (date.weekday() + 1) % 7
    sunday = date - datetime.timedelta(days=days_since_sunday)
    saturday = sunday + datetime.timedelta(days=6)
    return sunday, saturday


def _get_quarter_bounds(date: datetime.date) -> tuple[datetime.date, datetime.date]:
    quarter_month = ((date.month - 1) // 3) * 3 + 1
    quarter_start = datetime.date(date.year, quarter_month, 1)
    if quarter_month + 3 > 12:
        quarter_end = datetime.date(date.year + 1, 1, 1) - datetime.timedelta(days=1)
    else:
        quarter_end = datetime.date(date.year, quarter_month + 3, 1) - datetime.timedelta(days=1)
    return quarter_start, quarter_end


def _kf_to_response(kf: KeyFocus) -> KeyFocusResponse:
    return KeyFocusResponse(
        id=kf.id,
        title=kf.title,
        description=kf.description,
        kind=kf.kind,
        status=kf.status,
        frequency=kf.frequency,
        weekly_id=kf.weekly_id,
        task_count=len(kf.tasks),
        blocker_count=len(kf.blockers),
    )


def _load_key_focus(db: Session, key_focus_id: int) -> KeyFocus:
    stmt = (
        select(KeyFocus)
        .where(KeyFocus.id == key_focus_id)
        .options(
            selectinload(KeyFocus.tasks),
            selectinload(KeyFocus.blockers),
        )
    )
    kf = db.scalars(stmt).first()
    if not kf:
        raise HTTPException(status_code=404, detail="Key focus not found")
    return kf


@router.post("", response_model=KeyFocusResponse, status_code=201)
def create_key_focus(body: KeyFocusCreate, db: Session = Depends(get_db)):
    weekly = db.get(Weekly, body.weekly_id)
    if not weekly:
        raise HTTPException(status_code=404, detail="Weekly not found")
    kf = KeyFocus(**body.model_dump())
    db.add(kf)
    db.flush()
    db.refresh(kf)
    return _kf_to_response(kf)


@router.get("", response_model=list[KeyFocusResponse])
def list_key_focuses(
    weekly_id: int | None = Query(None),
    frequency: str | None = Query(None),
    date: datetime.date | None = Query(None),
    scope: str = Query("all", pattern="^(weekly|quarterly|all)$"),
    db: Session = Depends(get_db),
):
    stmt = select(KeyFocus).options(
        selectinload(KeyFocus.tasks),
        selectinload(KeyFocus.blockers),
    )

    if weekly_id is not None:
        stmt = stmt.where(KeyFocus.weekly_id == weekly_id)

    if frequency is not None:
        stmt = stmt.where(KeyFocus.frequency == frequency)

    if date is not None and scope != "all":
        if scope == "weekly":
            start, end = _get_week_bounds(date)
            stmt = stmt.join(Weekly, Weekly.id == KeyFocus.weekly_id).where(
                Weekly.week_start >= start, Weekly.week_start <= end
            )
        elif scope == "quarterly":
            q_start, q_end = _get_quarter_bounds(date)
            stmt = stmt.join(Weekly, Weekly.id == KeyFocus.weekly_id).where(
                Weekly.week_start >= q_start, Weekly.week_start <= q_end
            )

    key_focuses = db.scalars(stmt).unique().all()
    return [_kf_to_response(kf) for kf in key_focuses]


@router.get("/{key_focus_id}", response_model=KeyFocusResponse)
def get_key_focus(key_focus_id: int, db: Session = Depends(get_db)):
    return _kf_to_response(_load_key_focus(db, key_focus_id))


@router.patch("/{key_focus_id}", response_model=KeyFocusResponse)
def update_key_focus(
    key_focus_id: int, body: KeyFocusUpdate, db: Session = Depends(get_db)
):
    kf = _load_key_focus(db, key_focus_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(kf, field, value)
    db.flush()
    db.refresh(kf)
    return _kf_to_response(kf)


@router.delete("/{key_focus_id}", status_code=204)
def delete_key_focus(key_focus_id: int, db: Session = Depends(get_db)):
    kf = _load_key_focus(db, key_focus_id)
    db.delete(kf)


# --- Task association endpoints ---


@router.post(
    "/{key_focus_id}/tasks", response_model=TaskKeyFocusResponse, status_code=201
)
def add_task_to_key_focus(
    key_focus_id: int, body: TaskKeyFocusCreate, db: Session = Depends(get_db)
):
    kf = _load_key_focus(db, key_focus_id)
    task = db.get(Task, body.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    existing = db.get(TaskKeyFocus, (body.task_id, key_focus_id))
    if existing:
        raise HTTPException(status_code=409, detail="Association already exists")
    assoc = TaskKeyFocus(task_id=body.task_id, key_focus_id=kf.id)
    db.add(assoc)
    db.flush()
    return assoc


@router.get("/{key_focus_id}/tasks")
def list_key_focus_tasks(key_focus_id: int, db: Session = Depends(get_db)):
    kf = _load_key_focus(db, key_focus_id)
    return kf.tasks


@router.delete("/{key_focus_id}/tasks/{task_id}", status_code=204)
def remove_task_from_key_focus(
    key_focus_id: int, task_id: int, db: Session = Depends(get_db)
):
    assoc = db.get(TaskKeyFocus, (task_id, key_focus_id))
    if not assoc:
        raise HTTPException(status_code=404, detail="Association not found")
    db.delete(assoc)


# --- Nested blocker endpoints ---


@router.post(
    "/{key_focus_id}/blockers", response_model=BlockerResponse, status_code=201
)
def create_key_focus_blocker(
    key_focus_id: int, body: NestedBlockerCreate, db: Session = Depends(get_db)
):
    _load_key_focus(db, key_focus_id)
    blocker = Blocker(
        title=body.title,
        description=body.description,
        status=body.status,
        key_focus_id=key_focus_id,
    )
    db.add(blocker)
    db.flush()
    db.refresh(blocker)
    return blocker


@router.get("/{key_focus_id}/blockers", response_model=list[BlockerResponse])
def list_key_focus_blockers(key_focus_id: int, db: Session = Depends(get_db)):
    _load_key_focus(db, key_focus_id)
    stmt = select(Blocker).where(Blocker.key_focus_id == key_focus_id)
    return db.scalars(stmt).all()
