import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import WorkerState, WorkerType


class Worker(Base):
    __tablename__ = "worker"

    id: Mapped[str] = mapped_column(sa.String(32), primary_key=True)
    task_id: Mapped[int] = mapped_column(
        sa.Integer, sa.ForeignKey("task.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    type: Mapped[WorkerType] = mapped_column(
        sa.Enum(WorkerType), nullable=False, default=WorkerType.claude_code
    )
    state: Mapped[WorkerState] = mapped_column(
        sa.Enum(WorkerState), nullable=False, default=WorkerState.initialized
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        sa.DateTime, nullable=False, server_default=sa.func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()
    )

    task: Mapped["Task"] = relationship("Task", back_populates="worker")
    repositories: Mapped[list["Repository"]] = relationship(
        "Repository", secondary="worker_repository", back_populates="workers"
    )

    @property
    def effective_state(self) -> WorkerState:
        """Default effective state is the DB state. Overridden at API layer with live pod status."""
        return self.state
