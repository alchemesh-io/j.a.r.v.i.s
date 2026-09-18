import sqlalchemy as sa

from app.db.base import Base

scheduled_task_repository = sa.Table(
    "scheduled_task_repository",
    Base.metadata,
    sa.Column(
        "scheduled_task_id",
        sa.Integer,
        sa.ForeignKey("scheduled_task.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    sa.Column(
        "repository_id",
        sa.Integer,
        sa.ForeignKey("repository.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)
