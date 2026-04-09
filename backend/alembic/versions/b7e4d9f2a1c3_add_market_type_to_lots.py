"""add_market_type_to_lots

Add market_type enum column + is_buy_now, gallery_name, artist_website,
primary_score to the lots table.

Revision ID: b7e4d9f2a1c3
Revises: a3f8c2d1e9b0
Create Date: 2026-04-09
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b7e4d9f2a1c3'
down_revision: Union[str, None] = 'a3f8c2d1e9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

markettype_enum = sa.Enum('auction', 'primary', 'gallery', name='markettype')


def upgrade() -> None:
    markettype_enum.create(op.get_bind(), checkfirst=True)

    op.add_column('lots', sa.Column(
        'market_type',
        sa.Enum('auction', 'primary', 'gallery', name='markettype'),
        nullable=True, server_default='auction',
    ))
    op.add_column('lots', sa.Column('is_buy_now',     sa.Boolean(),      nullable=True, server_default='false'))
    op.add_column('lots', sa.Column('gallery_name',   sa.String(300),    nullable=True))
    op.add_column('lots', sa.Column('artist_website', sa.Text(),         nullable=True))
    op.add_column('lots', sa.Column('primary_score',  sa.Float(),        nullable=True))

    op.create_index('ix_lots_market_type', 'lots', ['market_type'])


def downgrade() -> None:
    op.drop_index('ix_lots_market_type', table_name='lots')
    op.drop_column('lots', 'primary_score')
    op.drop_column('lots', 'artist_website')
    op.drop_column('lots', 'gallery_name')
    op.drop_column('lots', 'is_buy_now')
    op.drop_column('lots', 'market_type')
    markettype_enum.drop(op.get_bind(), checkfirst=True)
