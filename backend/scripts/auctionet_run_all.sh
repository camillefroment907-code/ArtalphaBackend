#!/usr/bin/env bash
# Runs auctionet_backfill in 2000-lot batches until no lots remain,
# then fixes any remaining currency mismatches.
# Usage: DATABASE_URL=... bash scripts/auctionet_run_all.sh

set -e
cd "$(dirname "$0")/.."

BATCH=2000
MAX_ROUNDS=10

echo "=== Auctionet full backfill loop ==="
for i in $(seq 1 $MAX_ROUNDS); do
    echo ""
    echo "--- Round $i ---"
    python3 scripts/auctionet_backfill.py --commit --limit $BATCH 2>&1 | grep -v "HTTP Request"

    # Check remaining
    REMAINING=$(python3 -c "
import asyncio, sys
sys.path.insert(0, '.')
from sqlalchemy import text
from app.database import BgSessionLocal
async def r():
    async with BgSessionLocal() as db:
        res = await db.execute(text(\"SELECT COUNT(*) FROM lots WHERE source::text='auctionet' AND auction_date < NOW() - INTERVAL '6 hours' AND hammer_price IS NULL\"))
        print(res.scalar())
asyncio.run(r())
" 2>/dev/null)
    echo "Remaining after round $i: $REMAINING"
    if [ "$REMAINING" -eq 0 ]; then
        echo "All lots processed."
        break
    fi
done

echo ""
echo "=== Fixing currency mismatches ==="
python3 scripts/auctionet_fix_estimates.py 2>&1 | grep -v "HTTP Request"

echo ""
echo "=== Done ==="
