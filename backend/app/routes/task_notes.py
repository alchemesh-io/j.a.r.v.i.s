import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.task import Task
from app.models.task_note import TaskNote
from app.schemas.task_note import TaskNoteCreate, TaskNoteResponse, TaskNoteUpdate

router = APIRouter(prefix="/tasks/{task_id}/notes", tags=["task-notes"])


def _get_task_or_404(db: Session, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _get_note_or_404(db: Session, task_id: int, note_id: int) -> TaskNote:
    _get_task_or_404(db, task_id)
    stmt = select(TaskNote).where(TaskNote.id == note_id, TaskNote.task_id == task_id)
    note = db.scalars(stmt).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.post("", response_model=TaskNoteResponse, status_code=201)
def create_note(task_id: int, body: TaskNoteCreate, db: Session = Depends(get_db)):
    _get_task_or_404(db, task_id)
    note = TaskNote(task_id=task_id, content=body.content)
    db.add(note)
    db.flush()
    db.refresh(note)
    return note


@router.get("", response_model=list[TaskNoteResponse])
def list_notes(task_id: int, db: Session = Depends(get_db)):
    _get_task_or_404(db, task_id)
    stmt = (
        select(TaskNote)
        .where(TaskNote.task_id == task_id)
        .order_by(TaskNote.created_at.desc())
    )
    return db.scalars(stmt).all()


@router.patch("/{note_id}", response_model=TaskNoteResponse)
def update_note(
    task_id: int, note_id: int, body: TaskNoteUpdate, db: Session = Depends(get_db)
):
    note = _get_note_or_404(db, task_id, note_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(note, field, value)
    note.updated_at = datetime.datetime.now(datetime.UTC)
    db.flush()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=204)
def delete_note(task_id: int, note_id: int, db: Session = Depends(get_db)):
    note = _get_note_or_404(db, task_id, note_id)
    db.delete(note)
