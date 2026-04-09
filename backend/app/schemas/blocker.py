from pydantic import BaseModel, model_validator

from app.models.enums import BlockerStatus


class BlockerCreate(BaseModel):
    title: str
    description: str | None = None
    status: BlockerStatus = BlockerStatus.opened
    task_id: int | None = None
    key_focus_id: int | None = None

    @model_validator(mode="after")
    def validate_xor_reference(self) -> "BlockerCreate":
        if (self.task_id is None) == (self.key_focus_id is None):
            raise ValueError("Exactly one of task_id or key_focus_id must be set")
        return self


class NestedBlockerCreate(BaseModel):
    title: str
    description: str | None = None
    status: BlockerStatus = BlockerStatus.opened


class BlockerUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: BlockerStatus | None = None


class BlockerResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    title: str
    description: str | None
    status: BlockerStatus
    task_id: int | None
    key_focus_id: int | None
