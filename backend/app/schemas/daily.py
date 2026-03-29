import datetime

from pydantic import BaseModel

from app.schemas.daily_task import DailyTaskResponse


class DailyCreate(BaseModel):
    date: datetime.date
    weekly_id: int


class DailyResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    date: datetime.date
    weekly_id: int
    tasks: list[DailyTaskResponse] = []
