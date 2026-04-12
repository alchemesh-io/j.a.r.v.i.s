import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import KeyFocusFrequency, KeyFocusKind, KeyFocusStatus


class KeyFocus(Base):
    __tablename__ = "key_focus"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(sa.Text, nullable=False)
    description: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    kind: Mapped[KeyFocusKind] = mapped_column(sa.Enum(KeyFocusKind), nullable=False)
    status: Mapped[KeyFocusStatus] = mapped_column(
        sa.Enum(KeyFocusStatus), nullable=False, default=KeyFocusStatus.in_progress
    )
    frequency: Mapped[KeyFocusFrequency] = mapped_column(
        sa.Enum(KeyFocusFrequency), nullable=False
    )
    weekly_id: Mapped[int] = mapped_column(
        sa.ForeignKey("weekly.id", ondelete="CASCADE"), nullable=False
    )

    weekly: Mapped["Weekly"] = relationship("Weekly", back_populates="key_focuses")
    tasks: Mapped[list["Task"]] = relationship(
        "Task", secondary="task_key_focus", back_populates="key_focuses"
    )
    blockers: Mapped[list["Blocker"]] = relationship(
        "Blocker", back_populates="key_focus", cascade="all, delete-orphan"
    )
