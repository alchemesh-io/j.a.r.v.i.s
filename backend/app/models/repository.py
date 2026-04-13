import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Repository(Base):
    __tablename__ = "repository"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    git_url: Mapped[str] = mapped_column(sa.Text, nullable=False)
    branch: Mapped[str] = mapped_column(sa.String(255), nullable=False, default="main")

    __table_args__ = (
        sa.UniqueConstraint("git_url", "branch", name="uq_repository_git_url_branch"),
    )

    workers: Mapped[list["Worker"]] = relationship(
        "Worker", secondary="worker_repository", back_populates="repositories"
    )
