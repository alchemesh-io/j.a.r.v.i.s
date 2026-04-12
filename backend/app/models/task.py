import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import SourceType, TaskStatus, TaskType


class Task(Base):
    __tablename__ = "task"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_type: Mapped[SourceType | None] = mapped_column(sa.Enum(SourceType), nullable=True)
    source_id: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    title: Mapped[str] = mapped_column(sa.Text, nullable=False)
    type: Mapped[TaskType] = mapped_column(sa.Enum(TaskType), nullable=False)
    status: Mapped[TaskStatus] = mapped_column(
        sa.Enum(TaskStatus), nullable=False, default=TaskStatus.created
    )

    daily_entries: Mapped[list["DailyTask"]] = relationship(
        "DailyTask", back_populates="task", cascade="all, delete-orphan"
    )
    notes: Mapped[list["TaskNote"]] = relationship(
        "TaskNote", back_populates="task", cascade="all, delete-orphan"
    )
    key_focuses: Mapped[list["KeyFocus"]] = relationship(
        "KeyFocus", secondary="task_key_focus", back_populates="tasks"
    )
    blockers: Mapped[list["Blocker"]] = relationship(
        "Blocker", back_populates="task", cascade="all, delete-orphan"
    )

    @property
    def note_count(self) -> int:
        return len(self.notes)

    @property
    def dates(self) -> list:
        return sorted(entry.daily.date for entry in self.daily_entries)

    @property
    def blocker_count(self) -> int:
        return sum(1 for b in self.blockers if b.status.value == "opened")
