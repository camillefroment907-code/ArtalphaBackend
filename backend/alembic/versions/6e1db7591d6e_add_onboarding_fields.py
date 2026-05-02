"""add_onboarding_fields

Revision ID: 6e1db7591d6e
Revises: h3i4j5k6l7m8
Create Date: 2026-05-02 20:07:04.756355
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '6e1db7591d6e'
down_revision: Union[str, None] = 'h3i4j5k6l7m8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column(
        'onboarding_completed', sa.Boolean(),
        nullable=False, server_default=sa.text('false')
    ))
    op.add_column('preferences', sa.Column('preferred_market_type', sa.ARRAY(sa.String()), nullable=True))
    op.add_column('preferences', sa.Column('preferred_career_stages', sa.ARRAY(sa.String()), nullable=True))
    op.add_column('preferences', sa.Column('strategy_preset', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('preferences', 'strategy_preset')
    op.drop_column('preferences', 'preferred_career_stages')
    op.drop_column('preferences', 'preferred_market_type')
    op.drop_column('users', 'onboarding_completed')
