"""
One-shot fix: for the 228 Auctionet lots that already have hammer_price written
but still have their original SEK/DKK/GBP estimate_low, re-fetch the Auctionet
page and overwrite estimate_low + currency with the EUR values from item.estimate.

Run once, then delete.
    DATABASE_URL=... python3 scripts/auctionet_fix_estimates.py
"""
import asyncio, json, os, re, sys, time
import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from sqlalchemy import text
from app.database import BgSessionLocal

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9,sv;q=0.8",
}
_VIP = re.compile(r'window\.vipDataAtPageLoad\s*=\s*(\{.*?\})\s*(?:\n|;)', re.DOTALL)

def get_eur_estimate(html: str) -> float | None:
    m = _VIP.search(html)
    if not m:
        return None
    try:
        data = json.loads(m.group(1))
        est = data.get("item", {}).get("estimate")
        return float(est) if est is not None else None
    except Exception:
        return None

async def run():
    async with BgSessionLocal() as db:
        r = await db.execute(text("""
            SELECT id::text AS lot_id, external_id, currency, estimate_low, hammer_price
            FROM lots
            WHERE source::text = 'auctionet'
              AND hammer_price IS NOT NULL
              AND currency != 'EUR'
            ORDER BY id
        """))
        lots = r.mappings().all()

    print(f"Lots to fix: {len(lots)}")
    print(f"  (auctionet lots with hammer_price AND currency != EUR)")

    fixed = skipped = errors = 0

    with httpx.Client(timeout=15, headers=HEADERS, follow_redirects=True) as client:
        for lot in lots:
            item_id = re.sub(r'^auctionet-', '', lot['external_id'])
            url = f"https://auctionet.com/en/{item_id}"
            try:
                resp = client.get(url)
                if resp.status_code != 200:
                    print(f"  ⚠ {lot['external_id']}  HTTP {resp.status_code}")
                    errors += 1
                    time.sleep(1)
                    continue

                est_eur = get_eur_estimate(resp.text)
                if est_eur is None:
                    print(f"  ⚠ {lot['external_id']}  no estimate found")
                    errors += 1
                    time.sleep(1)
                    continue

                async with BgSessionLocal() as db:
                    await db.execute(text("""
                        UPDATE lots
                        SET estimate_low = :est,
                            currency     = 'EUR',
                            updated_at   = NOW()
                        WHERE id = CAST(:lid AS uuid)
                    """), {"est": est_eur, "lid": lot['lot_id']})
                    await db.commit()

                ratio = lot['hammer_price'] / est_eur if est_eur else 0
                print(f"  ✓ {lot['external_id']:<28}  "
                      f"est {lot['currency']} {lot['estimate_low']:.0f} → EUR {est_eur:.0f}  "
                      f"hammer={lot['hammer_price']:.0f}  ratio={ratio:.3f}")
                fixed += 1

            except Exception as e:
                print(f"  ✗ {lot['external_id']}  error: {e}")
                errors += 1

            time.sleep(1)

    print(f"\n{'─'*60}")
    print(f"Fixed   : {fixed}")
    print(f"Skipped : {skipped}")
    print(f"Errors  : {errors}")

if __name__ == "__main__":
    asyncio.run(run())
