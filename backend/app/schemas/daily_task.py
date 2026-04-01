from pydantic import BaseModel

from app.schemas.task import TaskResponse


class DailyTaskCreate(BaseModel):
    task_id: int
    priority: int


class DailyTaskResponse(BaseModel):
    model_config = {"from_attributes": True}

    task_id: int
    daily_id: int
    priority: int
    task: TaskResponse


class ReorderItem(BaseModel):
    task_id: int
    priority: int


class DailyTaskReorder(BaseModel):
    items: list[ReorderItem]
