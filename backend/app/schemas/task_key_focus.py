from pydantic import BaseModel


class TaskKeyFocusCreate(BaseModel):
    task_id: int


class TaskKeyFocusFromTask(BaseModel):
    key_focus_id: int


class TaskKeyFocusResponse(BaseModel):
    model_config = {"from_attributes": True}

    task_id: int
    key_focus_id: int
