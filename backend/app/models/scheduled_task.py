import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import (
    ScheduledTaskStatus,
    TaskType,
    WorkerMode,
    WorkerSessionMode,
    WorkerType,
)


class ScheduledTask(Base):
    __tablename__ = "scheduled_task"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(sa.Text, nullable=False)
    task_type: Mapped[TaskType] = mapped_column(sa.Enum(TaskType), nullable=False)
    note_content: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    cron_expression: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    status: Mapped[ScheduledTaskStatus] = mapped_column(
        sa.Enum(ScheduledTaskStatus),
        nullable=False,
        default=ScheduledTaskStatus.active,
        server_default=ScheduledTaskStatus.active.value,
    )

    worker_type: Mapped[WorkerType] = mapped_column(
        sa.Enum(WorkerType), nullable=False, default=WorkerType.claude_code, server_default=WorkerType.claude_code.value
    )
    worker_mode: Mapped[WorkerMode] = mapped_column(
        sa.Enum(WorkerMode), nullable=False, default=WorkerMode.ephemeral, server_default=WorkerMode.ephemeral.value
    )
    worker_session_mode: Mapped[WorkerSessionMode] = mapped_column(
        sa.Enum(WorkerSessionMode),
        nullable=False,
        default=WorkerSessionMode.auto,
        server_default=WorkerSessionMode.auto.value,
    )
    worker_cpu_request: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
    worker_memory_request: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
    worker_cpu_limit: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
    worker_memory_limit: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)

    skills: Mapped[list] = mapped_column(sa.JSON, nullable=False, default=list)

    last_run_at: Mapped[datetime.datetime | None] = mapped_column(sa.DateTime, nullable=True)
    next_run_at: Mapped[datetime.datetime | None] = mapped_column(sa.DateTime, nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(
        sa.DateTime, nullable=False, server_default=sa.func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()
    )

    repositories: Mapped[list["Repository"]] = relationship(
        "Repository", secondary="scheduled_task_repository", back_populates="scheduled_tasks"
    )
