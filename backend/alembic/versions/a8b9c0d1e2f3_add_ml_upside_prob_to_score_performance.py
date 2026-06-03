"""add_ml_upside_prob_to_score_performance

Revision ID: a8b9c0d1e2f3
Revises: z7a8b9c0d1e2
Create Date: 2026-06-03 00:00:00.000000

Additive-only migration.
Adds ml_upside_prob to score_performance so the ML model's prediction
is recorded alongside nautilus_score at scoring time, enabling
post-auction comparison of ML vs actual outcome.

Rollback: ALTER TABLE score_performance DROP COLUMN ml_upside_prob;
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "a8b9c0d1e2f3"
down_revision: Union[str, None] = "z7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "score_performance",
        sa.Column("ml_upside_prob", sa.Float, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("score_performance", "ml_upside_prob")
