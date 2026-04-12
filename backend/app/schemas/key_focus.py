from pydantic import BaseModel

from app.models.enums import KeyFocusFrequency, KeyFocusKind, KeyFocusStatus


class KeyFocusCreate(BaseModel):
    title: str
    description: str | None = None
    kind: KeyFocusKind
    status: KeyFocusStatus = KeyFocusStatus.in_progress
    frequency: KeyFocusFrequency
    weekly_id: int


class KeyFocusUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    kind: KeyFocusKind | None = None
    status: KeyFocusStatus | None = None
    frequency: KeyFocusFrequency | None = None
    weekly_id: int | None = None


class KeyFocusResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    title: str
    description: str | None
    kind: KeyFocusKind
    status: KeyFocusStatus
    frequency: KeyFocusFrequency
    weekly_id: int
    task_count: int = 0
    blocker_count: int = 0
