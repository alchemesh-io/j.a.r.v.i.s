from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import Repository
from app.models.enums import WorkerState
from app.models.worker_repository import worker_repository
from app.models.worker import Worker
from app.schemas.repository import RepositoryCreate, RepositoryResponse

router = APIRouter(prefix="/repositories", tags=["repositories"])

ACTIVE_STATES = {WorkerState.initialized, WorkerState.working, WorkerState.waiting_for_human, WorkerState.done}


def _repo_to_response(repo: Repository) -> RepositoryResponse:
    workers = repo.workers
    return RepositoryResponse(
        id=repo.id,
        git_url=repo.git_url,
        branch=repo.branch,
        worker_count=len(workers),
        active_worker_count=sum(1 for w in workers if w.state in ACTIVE_STATES),
    )


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
    return _repo_to_response(repo)


@router.get("", response_model=list[RepositoryResponse])
def list_repositories(db: Session = Depends(get_db)):
    repos = db.scalars(
        select(Repository).options(selectinload(Repository.workers))
    ).all()
    return [_repo_to_response(r) for r in repos]


@router.get("/{repository_id}", response_model=RepositoryResponse)
def get_repository(repository_id: int, db: Session = Depends(get_db)):
    repo = db.scalars(
        select(Repository)
        .where(Repository.id == repository_id)
        .options(selectinload(Repository.workers))
    ).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return _repo_to_response(repo)


@router.delete("/{repository_id}", status_code=204)
def delete_repository(repository_id: int, db: Session = Depends(get_db)):
    repo = db.scalars(
        select(Repository)
        .where(Repository.id == repository_id)
        .options(selectinload(Repository.workers))
    ).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    if any(w.state in ACTIVE_STATES for w in repo.workers):
        raise HTTPException(
            status_code=409,
            detail="Repository is in use by an active worker and cannot be deleted",
        )

    db.delete(repo)
