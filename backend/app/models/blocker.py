import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import BlockerStatus


class Blocker(Base):
    __tablename__ = "blocker"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(sa.Text, nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    status: Mapped[BlockerStatus] = mapped_column(
        sa.Enum(BlockerStatus), nullable=False, default=BlockerStatus.opened
    )
    task_id: Mapped[int | None] = mapped_column(
        sa.ForeignKey("task.id", ondelete="CASCADE"), nullable=True
    )
    key_focus_id: Mapped[int | None] = mapped_column(
        sa.ForeignKey("key_focus.id", ondelete="CASCADE"), nullable=True
    )

    __table_args__ = (
        sa.CheckConstraint(
            "(task_id IS NOT NULL AND key_focus_id IS NULL) OR "
            "(task_id IS NULL AND key_focus_id IS NOT NULL)",
            name="ck_blocker_xor_reference",
        ),
    )

    task: Mapped["Task | None"] = relationship("Task", back_populates="blockers")
    key_focus: Mapped["KeyFocus | None"] = relationship(
        "KeyFocus", back_populates="blockers"
    )
