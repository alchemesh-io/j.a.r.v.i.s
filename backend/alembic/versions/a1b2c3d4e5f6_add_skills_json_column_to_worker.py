"""add_skills_json_column_to_worker

Revision ID: a1b2c3d4e5f6
Revises: 00f312b05b23
Create Date: 2026-04-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e4666bd8e9fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('worker', sa.Column('skills', sa.JSON(), nullable=False, server_default='[]'))


def downgrade() -> None:
    op.drop_column('worker', 'skills')
