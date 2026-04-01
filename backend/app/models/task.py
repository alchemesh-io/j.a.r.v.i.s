import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import TaskStatus, TaskType


class Task(Base):
    __tablename__ = "task"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    jira_ticket_id: Mapped[str | None] = mapped_column(sa.String(20), nullable=True)
    title: Mapped[str] = mapped_column(sa.Text, nullable=False)
    type: Mapped[TaskType] = mapped_column(sa.Enum(TaskType), nullable=False)
    status: Mapped[TaskStatus] = mapped_column(
        sa.Enum(TaskStatus), nullable=False, default=TaskStatus.created
    )

    daily_entries: Mapped[list["DailyTask"]] = relationship(
        "DailyTask", back_populates="task", cascade="all, delete-orphan"
    )
