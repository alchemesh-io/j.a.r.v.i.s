import datetime

from pydantic import BaseModel

from app.models.enums import (
    ScheduledTaskStatus,
    TaskType,
    WorkerMode,
    WorkerSessionMode,
    WorkerType,
)
from app.schemas.repository import RepositoryResponse
from app.schemas.worker import SkillRef


class ScheduledTaskCreate(BaseModel):
    title: str
    task_type: TaskType
    note_content: str | None = None
    cron_expression: str
    status: ScheduledTaskStatus = ScheduledTaskStatus.active
    repository_ids: list[int] = []
    skills: list[SkillRef] = []
    worker_type: WorkerType = WorkerType.claude_code
    worker_mode: WorkerMode = WorkerMode.ephemeral
    worker_session_mode: WorkerSessionMode = WorkerSessionMode.auto
    worker_cpu_request: str | None = None
    worker_memory_request: str | None = None
    worker_cpu_limit: str | None = None
    worker_memory_limit: str | None = None


class ScheduledTaskUpdate(BaseModel):
    title: str | None = None
    task_type: TaskType | None = None
    note_content: str | None = None
    cron_expression: str | None = None
    status: ScheduledTaskStatus | None = None
    repository_ids: list[int] | None = None
    skills: list[SkillRef] | None = None
    worker_type: WorkerType | None = None
    worker_mode: WorkerMode | None = None
    worker_session_mode: WorkerSessionMode | None = None
    worker_cpu_request: str | None = None
    worker_memory_request: str | None = None
    worker_cpu_limit: str | None = None
    worker_memory_limit: str | None = None


class ScheduledTaskResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    title: str
    task_type: TaskType
    note_content: str | None
    cron_expression: str
    status: ScheduledTaskStatus
    worker_type: WorkerType
    worker_mode: WorkerMode
    worker_session_mode: WorkerSessionMode
    worker_cpu_request: str | None
    worker_memory_request: str | None
    worker_cpu_limit: str | None
    worker_memory_limit: str | None
    skills: list[SkillRef] = []
    repositories: list[RepositoryResponse] = []
    last_run_at: datetime.datetime | None
    next_run_at: datetime.datetime | None
    created_at: datetime.datetime
    updated_at: datetime.datetime
