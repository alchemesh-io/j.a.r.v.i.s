import datetime

from pydantic import BaseModel

from app.schemas.daily import DailyResponse


class WeeklyCreate(BaseModel):
    week_start: datetime.date


class WeeklyResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    week_start: datetime.date
    dailies: list[DailyResponse] = []
