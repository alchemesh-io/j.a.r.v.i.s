import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Opportunity(Base):
    __tablename__ = "opportunity"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(sa.Text, nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    key_focuses: Mapped[list["KeyFocus"]] = relationship(
        "KeyFocus", secondary="opportunity_key_focus", back_populates="opportunities"
    )

    @property
    def key_focus_count(self) -> int:
        return len(self.key_focuses)

    @property
    def task_count(self) -> int:
        task_ids = {task.id for kf in self.key_focuses for task in kf.tasks}
        return len(task_ids)
