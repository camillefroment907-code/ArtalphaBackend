"""
OpenAI quota guard — prevents 429 errors from killing the app.
Tracks daily request count in-process and stops when approaching limit.
Works per-process (API server + celery worker each track independently).
"""
from datetime import date

_daily_count = 0
_last_reset = date.today()
DAILY_LIMIT = 8000  # Leave 20% buffer before the 10k RPD hard limit


def can_make_request() -> bool:
    global _daily_count, _last_reset
    today = date.today()
    if today != _last_reset:
        _daily_count = 0
        _last_reset = today
    return _daily_count < DAILY_LIMIT


def record_request() -> None:
    global _daily_count
    _daily_count += 1


def mark_quota_exceeded() -> None:
    """Call this when OpenAI returns 429 — pins count at limit so can_make_request() returns False."""
    global _daily_count
    _daily_count = DAILY_LIMIT


def get_usage() -> dict:
    return {
        "daily_count": _daily_count,
        "daily_limit": DAILY_LIMIT,
        "remaining": max(0, DAILY_LIMIT - _daily_count),
        "can_make_request": can_make_request(),
    }
