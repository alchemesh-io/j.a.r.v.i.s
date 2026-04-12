import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Weekly(Base):
    __tablename__ = "weekly"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    week_start: Mapped[sa.Date] = mapped_column(sa.Date, nullable=False, unique=True)

    dailies: Mapped[list["Daily"]] = relationship(
        "Daily", back_populates="weekly", cascade="all, delete-orphan"
    )
    key_focuses: Mapped[list["KeyFocus"]] = relationship(
        "KeyFocus", back_populates="weekly", cascade="all, delete-orphan"
    )
