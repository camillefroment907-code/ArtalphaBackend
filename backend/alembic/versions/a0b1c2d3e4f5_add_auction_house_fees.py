"""add_auction_house_fees

Revision ID: a0b1c2d3e4f5
Revises: b9c0d1e2f3a4
Create Date: 2026-07-16 00:00:00.000000

Additive-only migration — creates:
  - auction_house_fees  (buyer's premium rates per auction house)

Rollback:
  DROP TABLE auction_house_fees;

Notes:
  Uses CREATE TABLE IF NOT EXISTS so the migration is safe to replay
  on envs where the table was already created manually.
  compute_max_bid() still reads from the in-memory BUYERS_PREMIUM_RATES
  dict in real_cost.py — this table is not yet wired into any live logic.
  Branching will be done in a separate PR.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "a0b1c2d3e4f5"
down_revision: Union[str, None] = "b9c0d1e2f3a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # IF NOT EXISTS — safe to re-run on envs where table was pre-created
    op.execute("""
        CREATE TABLE IF NOT EXISTS auction_house_fees (
            id               SERIAL PRIMARY KEY,
            name_normalized  TEXT         NOT NULL,
            buyer_premium_rate NUMERIC(6,4) NOT NULL,
            currency         CHAR(3)      NOT NULL DEFAULT 'EUR',
            source           TEXT,
            verified_at      DATE,
            created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

            CONSTRAINT uq_auction_house_fees_name UNIQUE (name_normalized),
            CONSTRAINT chk_buyer_premium_rate_range
                CHECK (buyer_premium_rate >= 0 AND buyer_premium_rate < 1)
        )
    """)

    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_auction_house_fees_name_normalized
        ON auction_house_fees (name_normalized)
    """)

    # Seed: known rates from real_cost.py BUYERS_PREMIUM_RATES (2026-07)
    # All rates are approximate flat rates — actual schedules may be tiered.
    op.execute("""
        INSERT INTO auction_house_fees
            (name_normalized, buyer_premium_rate, currency, source, verified_at)
        VALUES
            ('christies',  0.2600, 'EUR', 'real_cost.py BUYERS_PREMIUM_RATES', '2026-07-16'),
            ('sothebys',   0.2750, 'EUR', 'real_cost.py BUYERS_PREMIUM_RATES', '2026-07-16'),
            ('phillips',   0.2700, 'EUR', 'real_cost.py BUYERS_PREMIUM_RATES', '2026-07-16'),
            ('bonhams',    0.2500, 'EUR', 'real_cost.py BUYERS_PREMIUM_RATES', '2026-07-16'),
            ('drouot',     0.2500, 'EUR', 'real_cost.py BUYERS_PREMIUM_RATES', '2026-07-16'),
            ('artcurial',  0.2500, 'EUR', 'real_cost.py BUYERS_PREMIUM_RATES', '2026-07-16'),
            ('aguttes',    0.2200, 'EUR', 'real_cost.py BUYERS_PREMIUM_RATES', '2026-07-16'),
            ('millon',     0.2000, 'EUR', 'real_cost.py BUYERS_PREMIUM_RATES', '2026-07-16')
        ON CONFLICT (name_normalized) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_auction_house_fees_name_normalized")
    op.execute("DROP TABLE IF EXISTS auction_house_fees")
