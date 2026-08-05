import datetime

from pydantic import BaseModel

from app.models.enums import WorkerMode, WorkerState, WorkerType
from app.schemas.repository import RepositoryResponse


class SkillRef(BaseModel):
    name: str
    version: str = "latest"


class WorkerCreate(BaseModel):
    task_id: int
    repository_ids: list[int] = []
    skills: list[SkillRef] = []
    type: WorkerType = WorkerType.claude_code
    mode: WorkerMode = WorkerMode.ephemeral


class WorkerUpdate(BaseModel):
    state: WorkerState | None = None


class WorkerSummary(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    mode: WorkerMode
    state: WorkerState
    effective_state: WorkerState


class WorkerResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    task_id: int
    type: WorkerType
    mode: WorkerMode
    state: WorkerState
    effective_state: WorkerState
    pod_status: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    repositories: list[RepositoryResponse] = []
    skills: list[SkillRef] = []
    is_main: bool = False
