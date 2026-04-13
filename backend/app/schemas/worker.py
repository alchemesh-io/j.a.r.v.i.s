import datetime

from pydantic import BaseModel

from app.models.enums import WorkerState, WorkerType
from app.schemas.repository import RepositoryResponse


class WorkerCreate(BaseModel):
    task_id: int
    repository_ids: list[int] = []
    type: WorkerType = WorkerType.claude_code


class WorkerUpdate(BaseModel):
    state: WorkerState | None = None


class WorkerSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    state: WorkerState
    effective_state: WorkerState


class WorkerResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    task_id: int
    type: WorkerType
    state: WorkerState
    effective_state: WorkerState
    pod_status: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    repositories: list[RepositoryResponse] = []
