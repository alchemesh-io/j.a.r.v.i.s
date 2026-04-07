import datetime

from pydantic import BaseModel, field_validator


class TaskNoteCreate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Content must not be empty")
        return v


class TaskNoteUpdate(BaseModel):
    content: str | None = None

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Content must not be empty")
        return v


class TaskNoteResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    task_id: int
    content: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
