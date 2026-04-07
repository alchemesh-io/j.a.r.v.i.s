import datetime

from pydantic import BaseModel

from app.models.enums import SourceType, TaskStatus, TaskType


class TaskCreate(BaseModel):
    source_type: SourceType | None = None
    source_id: str | None = None

    title: str
    type: TaskType
    status: TaskStatus = TaskStatus.created


class TaskUpdate(BaseModel):
    source_type: SourceType | None = None
    source_id: str | None = None

    title: str | None = None
    type: TaskType | None = None
    status: TaskStatus | None = None


class TaskResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    source_type: SourceType | None
    source_id: str | None
    title: str
    type: TaskType
    status: TaskStatus
    dates: list[datetime.date] = []
    note_count: int = 0
