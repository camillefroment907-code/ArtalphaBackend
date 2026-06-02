"""add_artist_cycle_stats

Revision ID: y6z7a8b9c0d1
Revises: x5y6z7a8b9c0
Create Date: 2026-06-02 00:00:00.000000

Additive-only migration — creates the artist_cycle_stats table.
Rollback: DROP TABLE artist_cycle_stats.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "y6z7a8b9c0d1"
down_revision: Union[str, None] = "x5y6z7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "artist_cycle_stats",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("artist_id", UUID(as_uuid=True),
                  sa.ForeignKey("artists.id", ondelete="CASCADE"), nullable=False),
        sa.Column("computed_at", sa.DateTime, nullable=False,
                  server_default=sa.text("NOW()")),

        # Eligibility
        sa.Column("is_eligible",       sa.Boolean, nullable=False, server_default=sa.text("FALSE")),
        sa.Column("total_sales",       sa.Integer, nullable=True),
        sa.Column("recent_sales_3y",   sa.Integer, nullable=True),
        sa.Column("estimate_coverage", sa.Float,   nullable=True),

        # Best configuration
        sa.Column("best_medium",        sa.Text,    nullable=True),
        sa.Column("best_medium_wilson", sa.Float,   nullable=True),
        sa.Column("best_size",          sa.Text,    nullable=True),
        sa.Column("best_size_wilson",   sa.Float,   nullable=True),
        sa.Column("best_house",         sa.Text,    nullable=True),
        sa.Column("best_house_wilson",  sa.Float,   nullable=True),
        sa.Column("best_month",         sa.Integer, nullable=True),
        sa.Column("best_month_wilson",  sa.Float,   nullable=True),
        sa.Column("best_season",        sa.Text,    nullable=True),
        sa.Column("best_season_wilson", sa.Float,   nullable=True),

        # Full segment detail (JSONB)
        sa.Column("medium_stats", JSONB, nullable=True),
        sa.Column("size_stats",   JSONB, nullable=True),
        sa.Column("house_stats",  JSONB, nullable=True),
        sa.Column("month_stats",  JSONB, nullable=True),
        sa.Column("season_stats", JSONB, nullable=True),
    )

    # Unique constraint: one row per artist
    op.create_unique_constraint(
        "uq_artist_cycle_stats_artist",
        "artist_cycle_stats",
        ["artist_id"],
    )

    # Indexes for efficient lookups
    op.create_index("ix_artist_cycle_stats_artist_id", "artist_cycle_stats", ["artist_id"])
    op.create_index("ix_artist_cycle_stats_eligible",  "artist_cycle_stats", ["is_eligible"])


def downgrade() -> None:
    op.drop_index("ix_artist_cycle_stats_eligible",  table_name="artist_cycle_stats")
    op.drop_index("ix_artist_cycle_stats_artist_id", table_name="artist_cycle_stats")
    op.drop_constraint("uq_artist_cycle_stats_artist", "artist_cycle_stats", type_="unique")
    op.drop_table("artist_cycle_stats")
