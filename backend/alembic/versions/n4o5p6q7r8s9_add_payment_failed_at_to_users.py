"""add payment_failed_at to users

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-05-12
"""
from alembic import op
import sqlalchemy as sa

revision = 'n4o5p6q7r8s9'
down_revision = 'm3n4o5p6q7r8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('payment_failed_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('users', 'payment_failed_at')
