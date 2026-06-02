# Artist Cycle Intelligence — Implementation Report (Step 4)

## Architecture Overview

Step 4 adds a dedicated cycle intelligence layer on top of the existing `hammer_prices` data. The architecture is fully additive — no existing table, endpoint, or file was modified except:
1. Adding new Pydantic models to `backend/app/models/schemas.py`
2. Registering the new cycle router in `backend/app/main.py`
3. Adding the `ArtistCycleStats` ORM model to `backend/app/models/db_models.py`

### Data Flow

```
hammer_prices (raw data)
    ↓
compute_artist_cycle_stats.py (CLI batch job)
    ↓ calls cycle_intelligence.py (pure logic)
    ↓
artist_cycle_stats (persisted stats, JSONB)
    ↓
routers/cycle.py (REST API)
    ↓ calls cycle_intelligence.py
    ↓
Frontend: cycle fit score + bilingual explanations
```

## Files Created

| File | Purpose |
|---|---|
| `backend/app/engines/cycle_intelligence.py` | Pure logic: Wilson, eligibility, segment stats, cycle fit, explanations |
| `backend/app/routers/cycle.py` | FastAPI router with 4 additive endpoints |
| `backend/app/routers/__init__.py` | Package init |
| `backend/app/scripts/compute_artist_cycle_stats.py` | CLI batch computation tool |
| `backend/alembic/versions/y6z7a8b9c0d1_add_artist_cycle_stats.py` | Alembic migration |
| `backend/tests/test_artist_cycle.py` | 40+ unit tests |
| `docs/ARTIST_CYCLE_AUDIT.md` | Phase 0 audit |
| `docs/ARTIST_ELIGIBILITY_RULES.md` | Phase 1 methodology |
| `docs/CYCLE_CONFIDENCE_SYSTEM.md` | Phase 3 Wilson score documentation |
| `docs/ARTIST_CYCLE_IMPLEMENTATION_REPORT.md` | This file |

## Files Modified (Additive Only)

| File | Change |
|---|---|
| `backend/app/models/schemas.py` | Added: SegmentStats, ArtistCycleSummary, ArtistCycleDetail, CycleFitResult, CycleFitComponent, CycleFitRequest |
| `backend/app/models/db_models.py` | Added: ArtistCycleStats ORM model, JSONB import |
| `backend/app/main.py` | Added: cycle_router import and registration |

## Schema Changes

**Migration**: `y6z7a8b9c0d1_add_artist_cycle_stats`
**Table**: `artist_cycle_stats`

Key design choices:
- JSONB columns (`medium_stats`, `size_stats`, `house_stats`, `month_stats`, `season_stats`) for full segment detail — flexible schema, no future migrations needed for new dimensions
- `UNIQUE (artist_id)` — one row per artist, upserted on recompute
- `is_eligible` index — fast filter for eligible artists
- `ON DELETE CASCADE` from artists — self-cleaning

## APIs Added

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/cycle/artist/{artist_id}` | Summary: eligibility + best config |
| GET | `/api/v1/cycle/artist/{artist_id}/detail` | Full: includes JSONB segment data |
| POST | `/api/v1/cycle/fit` | Cycle fit score for a lot |
| GET | `/api/v1/cycle/artist/{artist_id}/fit` | GET alternative for cycle fit |

All endpoints require JWT auth and return null gracefully (never 500).

## Tests Added

`backend/tests/test_artist_cycle.py` — 40+ assertions covering:
- Wilson lower bound edge cases (n=0, n=1, n=3, n=150+)
- Confidence tier boundaries
- Artist eligibility (all 3 rules individually)
- Segment stats (empty, no estimates, mixed, no survivorship bias)
- Best config selection (ranking, min_sales filter)
- Cycle fit (perfect match → 100, unknown dimension → 0, missing data → null)
- Explanations in English and French
- API null safety (no 500 on any missing data combination)

## Risks

1. **No existing cycle stats data**: `artist_cycle_stats` starts empty. The router returns `is_eligible=False` gracefully until the CLI script is run.
2. **artist_name_normalized join**: Artists are joined to hammer_prices via `name_normalized`. If an artist in the `artists` table has a different normalization than the hammer_prices rows, they won't be matched. The CLI script handles this silently.
3. **JSONB size**: For highly prolific artists (1000+ sales, 50+ segment combinations), the JSONB stats could reach a few KB per row. This is acceptable.
4. **Stale data**: `artist_cycle_stats` must be recomputed periodically (add to Celery beat for production).

## Rollback Strategy

To completely remove Step 4:
```sql
DROP TABLE artist_cycle_stats;
```

Then:
1. Remove `ArtistCycleStats` ORM model from `db_models.py`
2. Remove cycle schemas from `schemas.py`
3. Remove `from app.routers.cycle import router as cycle_router` from `main.py`
4. Delete `backend/app/engines/cycle_intelligence.py`
5. Delete `backend/app/routers/`
6. Delete `backend/app/scripts/compute_artist_cycle_stats.py`

Everything is additive. No existing data or API is touched.

## Next Steps (Step 5 — Feedback Loop)

- Capture when users act on a cycle fit recommendation (via `user_events` table)
- Track whether lots that matched best config actually sold above estimate post-auction
- Calibrate weights (`_DIM_WEIGHTS`) based on prediction accuracy
- Add Celery beat job to recompute `artist_cycle_stats` weekly
- Expose cycle fit in lot scoring (`scoring.py` oracle boost analog)
