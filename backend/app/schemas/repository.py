from pydantic import BaseModel


class RepositoryCreate(BaseModel):
    git_url: str
    branch: str = "main"


class RepositoryResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    git_url: str
    branch: str
    worker_count: int = 0
    active_worker_count: int = 0
