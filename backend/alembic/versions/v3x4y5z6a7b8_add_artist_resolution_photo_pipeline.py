"""add_artist_resolution_photo_pipeline

Revision ID: v3x4y5z6a7b8
Revises: v2w3x4y5z6a7
Create Date: 2026-05-29 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision: str = "v3x4y5z6a7b8"
down_revision: Union[str, None] = "v2w3x4y5z6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── portfolio_items: make title & purchase_price_eur nullable ─────────────
    op.alter_column("portfolio_items", "title", nullable=True)
    op.alter_column("portfolio_items", "purchase_price_eur", nullable=True)

    # ── portfolio_items: artist resolution fields ─────────────────────────────
    op.add_column("portfolio_items", sa.Column(
        "artist_name_display", sa.Text(), nullable=True,
    ))
    op.add_column("portfolio_items", sa.Column(
        "artist_match_status", sa.String(20), nullable=True,
        server_default="unresolved",
    ))
    op.add_column("portfolio_items", sa.Column(
        "match_metadata", JSON(), nullable=True,
        server_default=sa.text("'{}'::json"),
    ))
    op.create_index(
        "ix_portfolio_items_artist_match_status",
        "portfolio_items",
        ["artist_match_status"],
    )

    # ── artist_aliases ────────────────────────────────────────────────────────
    op.create_table(
        "artist_aliases",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "artist_id", UUID(as_uuid=True),
            sa.ForeignKey("artists.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("alias", sa.Text(), nullable=False),
        sa.Column("alias_normalized", sa.Text(), nullable=False),
        sa.Column("alias_type", sa.String(50), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(),
            server_default=sa.text("NOW()"), nullable=False,
        ),
    )
    op.create_index("ix_artist_aliases_artist_id", "artist_aliases", ["artist_id"])
    # Trigram index for fuzzy alias matching
    op.execute(
        "CREATE INDEX ix_artist_aliases_normalized_gin "
        "ON artist_aliases USING gin(alias_normalized gin_trgm_ops)"
    )

    # ── portfolio_item_photos ─────────────────────────────────────────────────
    op.create_table(
        "portfolio_item_photos",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "portfolio_item_id", UUID(as_uuid=True),
            sa.ForeignKey("portfolio_items.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column(
            "analysis_status", sa.String(20), nullable=False,
            server_default="skipped",
        ),
        sa.Column("vision_results", JSON(), nullable=True),
        sa.Column("suggestions_accepted", JSON(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(),
            server_default=sa.text("NOW()"), nullable=False,
        ),
    )
    op.create_index(
        "ix_portfolio_item_photos_item_id",
        "portfolio_item_photos",
        ["portfolio_item_id"],
    )


def downgrade() -> None:
    op.drop_table("portfolio_item_photos")
    op.drop_table("artist_aliases")
    op.drop_index("ix_portfolio_items_artist_match_status", "portfolio_items")
    op.drop_column("portfolio_items", "match_metadata")
    op.drop_column("portfolio_items", "artist_match_status")
    op.drop_column("portfolio_items", "artist_name_display")
    op.alter_column("portfolio_items", "purchase_price_eur", nullable=False)
    op.alter_column("portfolio_items", "title", nullable=False)
