"""replace jira_ticket_id with source_type and source_id

Revision ID: b083d6039eaa
Revises: d8ae591b34ad
Create Date: 2026-04-04 00:37:52.299910

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b083d6039eaa'
down_revision: Union[str, None] = 'd8ae591b34ad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('task', sa.Column('source_type', sa.Enum('jira', 'gcal', name='sourcetype'), nullable=True))
    op.add_column('task', sa.Column('source_id', sa.String(length=255), nullable=True))

    # Migrate existing jira_ticket_id data
    op.execute("UPDATE task SET source_type = 'jira', source_id = jira_ticket_id WHERE jira_ticket_id IS NOT NULL")

    op.drop_column('task', 'jira_ticket_id')


def downgrade() -> None:
    op.add_column('task', sa.Column('jira_ticket_id', sa.VARCHAR(length=20), nullable=True))

    # Migrate back
    op.execute("UPDATE task SET jira_ticket_id = source_id WHERE source_type = 'jira'")

    op.drop_column('task', 'source_id')
    op.drop_column('task', 'source_type')
