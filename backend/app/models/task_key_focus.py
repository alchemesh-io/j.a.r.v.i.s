import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TaskKeyFocus(Base):
    __tablename__ = "task_key_focus"

    task_id: Mapped[int] = mapped_column(
        sa.ForeignKey("task.id", ondelete="CASCADE"), primary_key=True
    )
    key_focus_id: Mapped[int] = mapped_column(
        sa.ForeignKey("key_focus.id", ondelete="CASCADE"), primary_key=True
    )
