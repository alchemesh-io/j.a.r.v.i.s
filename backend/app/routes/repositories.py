from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Repository
from app.models.enums import WorkerState
from app.models.worker_repository import worker_repository
from app.models.worker import Worker
from app.schemas.repository import RepositoryCreate, RepositoryResponse

router = APIRouter(prefix="/repositories", tags=["repositories"])

ACTIVE_STATES = {WorkerState.initialized, WorkerState.working, WorkerState.waiting_for_human, WorkerState.done}


@router.post("", response_model=RepositoryResponse, status_code=201)
def create_repository(body: RepositoryCreate, db: Session = Depends(get_db)):
    repo = Repository(**body.model_dump())
    db.add(repo)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"Repository with git_url '{body.git_url}' and branch '{body.branch}' already exists",
        )
    db.refresh(repo)
    return RepositoryResponse.model_validate(repo)


@router.get("", response_model=list[RepositoryResponse])
def list_repositories(db: Session = Depends(get_db)):
    repos = db.scalars(select(Repository)).all()
    return [RepositoryResponse.model_validate(r) for r in repos]


@router.get("/{repository_id}", response_model=RepositoryResponse)
def get_repository(repository_id: int, db: Session = Depends(get_db)):
    repo = db.get(Repository, repository_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return RepositoryResponse.model_validate(repo)


@router.delete("/{repository_id}", status_code=204)
def delete_repository(repository_id: int, db: Session = Depends(get_db)):
    repo = db.get(Repository, repository_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    active_worker = db.scalars(
        select(Worker)
        .join(worker_repository, Worker.id == worker_repository.c.worker_id)
        .where(
            worker_repository.c.repository_id == repository_id,
            Worker.state.in_(ACTIVE_STATES),
        )
    ).first()
    if active_worker:
        raise HTTPException(
            status_code=409,
            detail="Repository is in use by an active worker and cannot be deleted",
        )

    db.delete(repo)
