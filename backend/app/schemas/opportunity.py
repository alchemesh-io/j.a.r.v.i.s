from pydantic import BaseModel


class OpportunityCreate(BaseModel):
    title: str
    description: str | None = None


class OpportunityUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class OpportunityResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    title: str
    description: str | None
    key_focus_ids: list[int] = []
    key_focus_count: int = 0
    task_count: int = 0


class OpportunityKeyFocusCreate(BaseModel):
    key_focus_id: int


class OpportunityKeyFocusResponse(BaseModel):
    model_config = {"from_attributes": True}

    opportunity_id: int
    key_focus_id: int
