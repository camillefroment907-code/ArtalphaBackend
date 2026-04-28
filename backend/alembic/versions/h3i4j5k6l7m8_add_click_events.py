"""add_click_events

Revision ID: h3i4j5k6l7m8
Revises: g2h3i4j5k6l7
Create Date: 2026-04-28 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'h3i4j5k6l7m8'
down_revision: Union[str, None] = 'g2h3i4j5k6l7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'click_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('lot_id', UUID(as_uuid=True), sa.ForeignKey('lots.id', ondelete='SET NULL'), nullable=True),
        sa.Column('destination_url', sa.Text(), nullable=False),
        sa.Column('clicked_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('ip', sa.String(45), nullable=True),
    )
    op.create_index('ix_click_events_lot_id',     'click_events', ['lot_id'])
    op.create_index('ix_click_events_user_id',    'click_events', ['user_id'])
    op.create_index('ix_click_events_clicked_at', 'click_events', ['clicked_at'])


def downgrade() -> None:
    op.drop_index('ix_click_events_clicked_at', table_name='click_events')
    op.drop_index('ix_click_events_user_id',    table_name='click_events')
    op.drop_index('ix_click_events_lot_id',     table_name='click_events')
    op.drop_table('click_events')
