import sqlalchemy as sa

from app.db.base import Base

worker_repository = sa.Table(
    "worker_repository",
    Base.metadata,
    sa.Column(
        "worker_id",
        sa.String(32),
        sa.ForeignKey("worker.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    sa.Column(
        "repository_id",
        sa.Integer,
        sa.ForeignKey("repository.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)
