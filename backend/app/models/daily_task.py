import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DailyTask(Base):
    __tablename__ = "daily_tasks"

    daily_id: Mapped[int] = mapped_column(
        sa.ForeignKey("daily.id", ondelete="CASCADE"), primary_key=True
    )
    task_id: Mapped[int] = mapped_column(
        sa.ForeignKey("task.id", ondelete="CASCADE"), primary_key=True
    )
    priority: Mapped[int] = mapped_column(nullable=False)

    __table_args__ = (
        sa.UniqueConstraint("daily_id", "priority", name="uq_daily_priority"),
    )

    daily: Mapped["Daily"] = relationship("Daily", back_populates="tasks")
    task: Mapped["Task"] = relationship("Task", back_populates="daily_entries")
