"""add_last_alert_sent_at_to_user_alert_preferences

Revision ID: u1v2w3x4y5z6
Revises: t0u1v2w3x4y5
Create Date: 2026-05-27 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "u1v2w3x4y5z6"
down_revision: Union[str, None] = "t0u1v2w3x4y5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_alert_preferences",
        sa.Column("last_alert_sent_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_alert_preferences", "last_alert_sent_at")
