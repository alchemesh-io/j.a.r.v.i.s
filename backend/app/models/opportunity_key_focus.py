import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OpportunityKeyFocus(Base):
    __tablename__ = "opportunity_key_focus"

    opportunity_id: Mapped[int] = mapped_column(
        sa.ForeignKey("opportunity.id", ondelete="CASCADE"), primary_key=True
    )
    key_focus_id: Mapped[int] = mapped_column(
        sa.ForeignKey("key_focus.id", ondelete="CASCADE"), primary_key=True
    )
