"""
One-shot + recurring DB dedup cleanup.
Removes duplicate lots already in DB that slipped through before the quality filter was added.
Safe to run multiple times — idempotent.
"""
import asyncio
from datetime import datetime
import structlog

logger = structlog.get_logger()


async def _dedup_existing_lots():
    from app.database import BgSessionLocal as AsyncSessionLocal
    from app.models.db_models import Lot, Alert
    from sqlalchemy import select, func, and_, text
    from app.jobs.quality_filter import normalize_title, normalize_artist_name

    async with AsyncSessionLocal() as session:
        # Step 1: Find groups of lots with same source + similar title + similar artist
        # Use raw SQL for efficiency
        stmt = text("""
            SELECT
                source,
                LOWER(REGEXP_REPLACE(title, '[^\\w\\s]', ' ', 'g')) as norm_title,
                LOWER(COALESCE(artist_name_raw, '')) as norm_artist,
                array_agg(id ORDER BY created_at ASC) as lot_ids,
                COUNT(*) as cnt
            FROM lots
            WHERE auction_date >= NOW() OR auction_date IS NULL
            GROUP BY source,
                     LOWER(REGEXP_REPLACE(title, '[^\\w\\s]', ' ', 'g')),
                     LOWER(COALESCE(artist_name_raw, ''))
            HAVING COUNT(*) > 1
        """)

        result = await session.execute(stmt)
        groups = result.fetchall()

        total_deleted = 0
        for group in groups:
            lot_ids = group.lot_ids  # ordered oldest first
            # Keep the first (oldest = most complete), delete the rest
            ids_to_delete = lot_ids[1:]

            for lot_id in ids_to_delete:
                # Check if any alert was sent for this lot
                alert_check = await session.execute(
                    select(Alert).where(Alert.lot_id == lot_id).limit(1)
                )
                if alert_check.scalar_one_or_none():
                    continue  # Don't delete lots with sent alerts

                lot = await session.execute(
                    select(Lot).where(Lot.id == lot_id)
                )
                lot_obj = lot.scalar_one_or_none()
                if lot_obj:
                    await session.delete(lot_obj)
                    total_deleted += 1

        await session.commit()
        logger.info("DB dedup cleanup complete", deleted=total_deleted, groups_found=len(groups))
        return total_deleted


def run_dedup_cleanup():
    """Entry point for Celery or manual run."""
    return asyncio.run(_dedup_existing_lots())


if __name__ == "__main__":
    deleted = run_dedup_cleanup()
    print(f"Deleted {deleted} duplicate lots")
