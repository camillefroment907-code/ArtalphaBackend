"""add_user_events

Revision ID: s9t0u1v2w3x4
Revises: r8s9t0u1v2w3
Create Date: 2026-05-25 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = 's9t0u1v2w3x4'
down_revision: Union[str, None] = 'r8s9t0u1v2w3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('lot_id',  UUID(as_uuid=True), sa.ForeignKey('lots.id',  ondelete='SET NULL'), nullable=True),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_user_events_user_id',    'user_events', ['user_id'])
    op.create_index('ix_user_events_lot_id',     'user_events', ['lot_id'])
    op.create_index('ix_user_events_created_at', 'user_events', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_user_events_created_at', table_name='user_events')
    op.drop_index('ix_user_events_lot_id',     table_name='user_events')
    op.drop_index('ix_user_events_user_id',    table_name='user_events')
    op.drop_table('user_events')
