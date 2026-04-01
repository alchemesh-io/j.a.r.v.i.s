import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Daily(Base):
    __tablename__ = "daily"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    date: Mapped[sa.Date] = mapped_column(sa.Date, nullable=False, unique=True)
    weekly_id: Mapped[int] = mapped_column(
        sa.ForeignKey("weekly.id", ondelete="CASCADE"), nullable=False
    )

    weekly: Mapped["Weekly"] = relationship("Weekly", back_populates="dailies")
    tasks: Mapped[list["DailyTask"]] = relationship(
        "DailyTask", back_populates="daily", cascade="all, delete-orphan"
    )
