"""add_auction_subscriptions

Revision ID: k6l7m8n9o0p1
Revises: j5k6l7m8n9o0
Create Date: 2026-05-06 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'k6l7m8n9o0p1'
down_revision: Union[str, None] = 'j5k6l7m8n9o0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'auction_subscriptions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(10), nullable=False),
        sa.Column('lot_id', UUID(as_uuid=True), sa.ForeignKey('lots.id', ondelete='CASCADE'), nullable=True),
        sa.Column('auction_house_name', sa.String(300), nullable=True),
        sa.Column('auction_date', sa.DateTime(), nullable=True),
        sa.Column('notified_1h', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('notified_30min', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_auction_subs_user_id', 'auction_subscriptions', ['user_id'])
    op.create_index('ix_auction_subs_auction_date', 'auction_subscriptions', ['auction_date'])


def downgrade() -> None:
    op.drop_index('ix_auction_subs_auction_date', table_name='auction_subscriptions')
    op.drop_index('ix_auction_subs_user_id', table_name='auction_subscriptions')
    op.drop_table('auction_subscriptions')
