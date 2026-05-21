"""add trial_end to users

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa

revision = 'r8s9t0u1v2w3'
down_revision = 'q7r8s9t0u1v2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('trial_end', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('users', 'trial_end')
