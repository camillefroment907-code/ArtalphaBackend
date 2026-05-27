"""
Diagnostic script — AgentAlert pipeline for a specific user.

Usage (from repo root, with DATABASE_URL in env):
    railway run python -m app.scripts.diagnose_agent_alerts

Or locally:
    DATABASE_URL=postgresql://... python -m app.scripts.diagnose_agent_alerts

What it checks:
  1. User record + subscription plan (eligibility gate)
  2. Active AgentAlerts for this user
  3. Lots evaluated in the last 24h (what the agent would see)
  4. AgentRecommendations created in the last 7 days
  5. Alert dedup table (past sends)
  6. UserAlertPreferences (notify_email per alert + global email_notifications)
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta

# ── DB setup ─────────────────────────────────────────────────────────────────
DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    sys.exit("❌  DATABASE_URL is not set. Export it or run via: railway run python -m app.scripts.diagnose_agent_alerts")

# Ensure asyncpg driver + strip query params asyncpg can't handle in the URL
import re
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

for prefix in ("postgres://", "postgresql://"):
    if DATABASE_URL.startswith(prefix):
        DATABASE_URL = "postgresql+asyncpg://" + DATABASE_URL[len(prefix):]
        break

# asyncpg doesn't accept sslmode/channel_binding in the URL — strip them
# and pass ssl=True via connect_args instead
parsed = urlparse(DATABASE_URL)
qs = parse_qs(parsed.query)
needs_ssl = qs.pop("sslmode", None) is not None
qs.pop("channel_binding", None)
clean_url = urlunparse(parsed._replace(query=urlencode({k: v[0] for k, v in qs.items()})))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, and_, text

import ssl as _ssl
if needs_ssl:
    _ssl_ctx = _ssl.create_default_context()
    _ssl_ctx.check_hostname = False
    _ssl_ctx.verify_mode = _ssl.CERT_NONE
    connect_args = {"ssl": _ssl_ctx}
else:
    connect_args = {}
engine = create_async_engine(clean_url, echo=False, connect_args=connect_args)
Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

TARGET_EMAIL = "camille"   # partial match — change if needed


# ── Helpers ───────────────────────────────────────────────────────────────────

def sep(title: str):
    print(f"\n{'─'*60}")
    print(f"  {title}")
    print('─'*60)


def fmt(val):
    if val is None:
        return "—"
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d %H:%M UTC")
    return str(val)


# ── Main diagnostic ──────────────────────────────────────────────────────────

async def run():
    async with Session() as db:

        # ── 1. User + Subscription ────────────────────────────────────────────
        sep("1. USER + SUBSCRIPTION")
        rows = await db.execute(text("""
            SELECT
                u.id,
                u.email,
                u.is_active,
                u.created_at,
                s.plan,
                s.status  AS sub_status,
                u.trial_end
            FROM users u
            LEFT JOIN subscriptions s ON s.user_id = u.id
            WHERE u.email ILIKE :pattern
            ORDER BY u.created_at DESC
        """), {"pattern": f"%{TARGET_EMAIL}%"})
        users = rows.fetchall()

        if not users:
            print(f"  ⚠️  No user found matching '{TARGET_EMAIL}'")
            return

        for u in users:
            plan = (u.plan or "free").lower()
            eligible = plan in ("investor", "pro", "institutional", "expert")
            print(f"  id          : {u.id}")
            print(f"  email       : {u.email}")
            print(f"  is_active   : {u.is_active}")
            print(f"  plan        : {fmt(u.plan)}  (sub_status={fmt(u.sub_status)}, trial_end={fmt(u.trial_end)})")
            print(f"  agent-eligible : {'✅ YES' if eligible else '❌ NO — plan must be investor/pro/institutional/expert'}")
            print()

        # Use first match for subsequent queries
        user_id = users[0].id
        user_email = users[0].email

        # ── 2. Active AgentAlerts ─────────────────────────────────────────────
        sep("2. ACTIVE AGENT ALERTS")
        rows = await db.execute(text("""
            SELECT
                id,
                name,
                is_active,
                notify_email,
                artist_name,
                category,
                budget_min_eur,
                budget_max_eur,
                min_conviction_score,
                created_at,
                updated_at
            FROM agent_alerts
            WHERE user_id = :uid
            ORDER BY created_at DESC
        """), {"uid": user_id})
        alerts = rows.fetchall()

        if not alerts:
            print("  ⚠️  No AgentAlerts found for this user.")
        else:
            for a in alerts:
                active_flag = "✅ active" if a.is_active else "❌ inactive"
                notify_flag = "✅ notify_email=True" if a.notify_email else "❌ notify_email=False"
                print(f"  [{active_flag}] [{notify_flag}]")
                print(f"    id               : {a.id}")
                print(f"    name             : {a.name}")
                print(f"    artist_name      : {fmt(a.artist_name)}")
                print(f"    category         : {fmt(a.category)}")
                print(f"    budget           : {fmt(a.budget_min_eur)} – {fmt(a.budget_max_eur)} EUR")
                print(f"    min_conviction   : {a.min_conviction_score}")
                print(f"    created_at       : {fmt(a.created_at)}")
                print(f"    updated_at       : {fmt(a.updated_at)}")
                print()

        # ── 3. Lots seen by last agent run (scored in last 24h, score ≥ 45) ──
        sep("3. LOTS ELIGIBLE FOR AGENT (scored last 24h, deal_score ≥ 45)")
        lookback = datetime.utcnow() - timedelta(hours=24)
        rows = await db.execute(text("""
            SELECT id, title, artist_name_raw, deal_score, status, scored_at, auction_date
            FROM lots
            WHERE scored_at >= :lookback
              AND deal_score >= 45
            ORDER BY deal_score DESC
            LIMIT 20
        """), {"lookback": lookback})
        lots = rows.fetchall()

        if not lots:
            print(f"  ⚠️  No lots scored in the last 24h with score ≥ 45.")
            print(f"       → Agent had nothing to evaluate. This alone explains 0 emails.")
        else:
            print(f"  {len(lots)} lots found (showing top 20 by score):")
            for l in lots:
                print(f"    score={l.deal_score:>5.1f}  status={l.status:<12}  scored={fmt(l.scored_at)}  title={str(l.title or '')[:50]}")

        # Full count
        rows2 = await db.execute(text("""
            SELECT COUNT(*) FROM lots
            WHERE scored_at >= :lookback AND deal_score >= 45
        """), {"lookback": lookback})
        total = rows2.scalar()
        print(f"\n  Total lots in window: {total}")

        # ── 4. Recent AgentRecommendations (last 7 days) ──────────────────────
        sep("4. AGENT RECOMMENDATIONS (last 7 days)")
        rows = await db.execute(text("""
            SELECT
                ar.id,
                ar.alert_id,
                ar.verdict,
                ar.conviction_score,
                ar.created_at,
                ar.notified_at,
                ar.is_read,
                l.title   AS lot_title,
                l.deal_score,
                aa.name   AS alert_name
            FROM agent_recommendations ar
            LEFT JOIN lots l ON l.id = ar.lot_id
            LEFT JOIN agent_alerts aa ON aa.id = ar.alert_id
            WHERE ar.user_id = :uid
              AND ar.created_at >= :since
            ORDER BY ar.created_at DESC
            LIMIT 30
        """), {"uid": user_id, "since": datetime.utcnow() - timedelta(days=7)})
        recs = rows.fetchall()

        if not recs:
            print("  ⚠️  No AgentRecommendations in the last 7 days.")
            print("       → run_agent_for_alert() either wasn't called or returned 0 matches.")
        else:
            print(f"  {len(recs)} recommendation(s):")
            for r in recs:
                notified = f"email sent {fmt(r.notified_at)}" if r.notified_at else "no email sent"
                print(f"    [{r.verdict:<10}] conviction={r.conviction_score}  [{notified}]")
                print(f"      alert : {r.alert_name}")
                print(f"      lot   : {str(r.lot_title or '—')[:60]}  (deal_score={r.deal_score})")
                print(f"      created: {fmt(r.created_at)}")
                print()

        # ── 5. Alert dedup table ──────────────────────────────────────────────
        sep("5. ALERT DEDUP TABLE (all past sends for this user)")
        rows = await db.execute(text("""
            SELECT id, lot_id, channel, message, deal_score_at_send, sent_at, is_delivered
            FROM alerts
            WHERE user_id = :uid
            ORDER BY sent_at DESC
            LIMIT 20
        """), {"uid": user_id})
        past = rows.fetchall()

        if not past:
            print("  No entries in alerts table — no alert has ever been sent to this user.")
        else:
            for a in past:
                print(f"  {fmt(a.sent_at)}  [{a.channel}]  {a.message}  score={a.deal_score_at_send}  delivered={a.is_delivered}")

        # ── 6. UserAlertPreferences ───────────────────────────────────────────
        sep("6. USER ALERT PREFERENCES")
        rows = await db.execute(text("""
            SELECT
                email_notifications,
                exceptional_opportunity,
                artist_momentum_change,
                auction_closing_24h
            FROM user_alert_preferences
            WHERE user_id = :uid
        """), {"uid": user_id})
        prefs = rows.fetchone()

        if not prefs:
            print("  ⚠️  No UserAlertPreferences row found.")
            print("       → Row may be missing (only affects alert_triggers.py, not the agent pipeline directly)")
        else:
            print(f"  email_notifications    : {prefs.email_notifications}")
            print(f"  exceptional_opportunity: {prefs.exceptional_opportunity}")
            print(f"  artist_momentum_change : {prefs.artist_momentum_change}")
            print(f"  auction_closing_24h    : {prefs.auction_closing_24h}")

        # ── Summary ───────────────────────────────────────────────────────────
        sep("SUMMARY")
        plan = (users[0].plan or "free").lower()
        sub_status = (users[0].sub_status or "").lower()
        eligible = plan in ("investor", "pro", "institutional", "expert") and sub_status in ("active", "trialing", "")

        active_alerts = [a for a in alerts if a.is_active]
        notify_alerts = [a for a in active_alerts if a.notify_email]

        reasons = []
        if not eligible:
            reasons.append(f"❌ Plan '{plan}' (status='{sub_status}') is not in eligible set [investor, pro, institutional, expert]")
        if not active_alerts:
            reasons.append("❌ No active AgentAlerts")
        elif not notify_alerts:
            reasons.append("❌ All active AgentAlerts have notify_email=False")
        if total == 0:
            reasons.append("❌ No lots scored in the last 24h with deal_score ≥ 45 — agent had nothing to process")
        if not recs:
            reasons.append("❌ run_agent_for_alert() produced 0 recommendations (GPT-4o found no match, or wasn't called)")

        if reasons:
            print("  Why no email was sent:")
            for r in reasons:
                print(f"    {r}")
        else:
            print("  ✅ All conditions look met — check Railway logs for 'agent_email_sent' or 'agent_email_failed'")


if __name__ == "__main__":
    asyncio.run(run())
