"""add_worker_mode_and_stopped_error_states

Revision ID: c5f1a9d3e2b7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-28 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5f1a9d3e2b7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_NEW_STATES = ('initialized', 'working', 'waiting_for_human', 'done', 'archived', 'stopped', 'error')
_OLD_STATES = ('initialized', 'working', 'waiting_for_human', 'done', 'archived')
_MODES = ('ephemeral', 'stateful')


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'postgresql':
        op.execute("ALTER TYPE workerstate ADD VALUE IF NOT EXISTS 'stopped'")
        op.execute("ALTER TYPE workerstate ADD VALUE IF NOT EXISTS 'error'")
        workermode = sa.Enum(*_MODES, name='workermode')
        workermode.create(bind, checkfirst=True)
        op.add_column(
            'worker',
            sa.Column('mode', workermode, nullable=False, server_default='ephemeral'),
        )
    else:
        # SQLite: rebuild the table to update the workerstate CHECK constraint and add the column.
        with op.batch_alter_table('worker') as batch_op:
            batch_op.add_column(
                sa.Column(
                    'mode',
                    sa.Enum(*_MODES, name='workermode'),
                    nullable=False,
                    server_default='ephemeral',
                ),
            )
            batch_op.alter_column(
                'state',
                existing_type=sa.Enum(*_OLD_STATES, name='workerstate'),
                type_=sa.Enum(*_NEW_STATES, name='workerstate'),
                existing_nullable=False,
            )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'postgresql':
        op.drop_column('worker', 'mode')
        sa.Enum(name='workermode').drop(bind, checkfirst=True)
        # Note: PostgreSQL cannot remove enum values without recreating the type.
        # We leave 'stopped' and 'error' in workerstate; they are unused after downgrade.
    else:
        with op.batch_alter_table('worker') as batch_op:
            batch_op.alter_column(
                'state',
                existing_type=sa.Enum(*_NEW_STATES, name='workerstate'),
                type_=sa.Enum(*_OLD_STATES, name='workerstate'),
                existing_nullable=False,
            )
            batch_op.drop_column('mode')
