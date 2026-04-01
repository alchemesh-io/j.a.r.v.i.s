import datetime

from pydantic import BaseModel

from app.models.enums import TaskStatus, TaskType


class TaskCreate(BaseModel):
    jira_ticket_id: str | None = None
    title: str
    type: TaskType
    status: TaskStatus = TaskStatus.created


class TaskUpdate(BaseModel):
    jira_ticket_id: str | None = None
    title: str | None = None
    type: TaskType | None = None
    status: TaskStatus | None = None


class TaskResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    jira_ticket_id: str | None
    title: str
    type: TaskType
    status: TaskStatus
    dates: list[datetime.date] = []
