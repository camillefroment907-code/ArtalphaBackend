"""
Feedback API — NPS scores, cancellation reasons, freeform feedback.
GET /api/feedback/nps?score=[0-10]&user_id=[id]
GET /api/feedback/cancellation?reason=[reason]&user_id=[id]
POST /api/feedback/submit
"""
import asyncio
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from typing import Optional
from datetime import datetime
import structlog

from app.database import get_db
from app.models.db_models import User
from app.api.auth_utils import get_current_user_optional
from app.services.email_service import send_admin_notification
from app.config import get_settings

settings = get_settings()
logger = structlog.get_logger().bind(module="feedback")
router = APIRouter(prefix="/feedback", tags=["feedback"])

TRUSTPILOT_URL = "https://www.trustpilot.com/review/get-nautilus.com"
ADMIN_EMAIL = "camillefroment907@gmail.com"


# ── NPS ───────────────────────────────────────────────────────────────────────

@router.post("/nps")
async def submit_nps(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Called from in-app NPS survey widget.
    Accepts score + optional comment, stores response, notifies admin on detractors.
    """
    score = body.get("score")
    comment = (body.get("comment") or "").strip()

    if score is None or not isinstance(score, int) or not (0 <= score <= 10):
        raise HTTPException(400, "score must be integer 0-10")

    user_id = str(current_user.id) if current_user else None

    try:
        await db.execute(
            text("INSERT INTO nps_responses (user_id, score, comment) VALUES (:uid, :score, :comment)"),
            {"uid": user_id, "score": score, "comment": comment or None},
        )
        await db.commit()
    except Exception as e:
        logger.warning("nps_store_failed", error=str(e))

    if score <= 6:
        try:
            asyncio.create_task(send_admin_notification(
                subject=f"⚠️ NPS Detractor — score {score}/10 (user: {user_id or 'unknown'})",
                html=f"""
                <div style="font-family: Georgia, serif; padding: 32px; max-width: 480px;">
                  <h2 style="color: #0A1628;">NPS Detractor Alert</h2>
                  <p><strong>Score:</strong> {score}/10</p>
                  <p><strong>User ID:</strong> {user_id or 'anonymous'}</p>
                  <p><strong>Comment:</strong> {comment or '(none)'}</p>
                  <p><strong>Date:</strong> {datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC</p>
                </div>
                """,
            ))
        except Exception:
            pass

    return {"status": "received"}


@router.get("/nps")
async def record_nps(
    score: int = Query(..., ge=0, le=10),
    user_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Called via link click from monthly NPS email.
    Stores response, returns redirect target.
    """
    try:
        await db.execute(
            text("""
                CREATE TABLE IF NOT EXISTS nps_responses (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    user_id TEXT,
                    score INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
        )
        await db.execute(
            text("INSERT INTO nps_responses (user_id, score) VALUES (:uid, :score)"),
            {"uid": user_id, "score": score},
        )
        await db.commit()
    except Exception as e:
        logger.warning("nps_store_failed", error=str(e))

    # Notify admin on detractors (score <= 6)
    if score <= 6:
        try:
            asyncio.create_task(send_admin_notification(
                subject=f"⚠️ NPS Detractor — score {score}/10 (user: {user_id or 'unknown'})",
                html=f"""
                <div style="font-family: Georgia, serif; padding: 32px; max-width: 480px;">
                  <h2 style="color: #0A1628;">NPS Detractor Alert</h2>
                  <p><strong>Score:</strong> {score}/10</p>
                  <p><strong>User ID:</strong> {user_id or 'anonymous'}</p>
                  <p><strong>Date:</strong> {datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC</p>
                  <p>Consider reaching out to understand the issue.</p>
                </div>
                """,
            ))
        except Exception:
            pass

    if score >= 9:
        return {"redirect": TRUSTPILOT_URL}
    elif score >= 7:
        return {"redirect": "/feedback?type=suggestions"}
    else:
        return {"redirect": "/feedback?type=help"}


# ── Cancellation reasons ──────────────────────────────────────────────────────

VALID_REASONS = frozenset({
    "too_expensive", "missing_features", "found_alternative",
    "not_using", "technical_issues", "other",
})

@router.get("/cancellation")
async def record_cancellation_reason(
    reason: str = Query(...),
    user_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    Called via one-click survey links in cancellation email.
    Returns a thank-you HTML page.
    """
    if reason not in VALID_REASONS:
        reason = "other"

    try:
        await db.execute(
            text("""
                CREATE TABLE IF NOT EXISTS cancellation_reasons (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    user_id TEXT,
                    reason TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
        )
        await db.execute(
            text("INSERT INTO cancellation_reasons (user_id, reason) VALUES (:uid, :reason)"),
            {"uid": user_id, "reason": reason},
        )
        await db.commit()
        logger.info("cancellation_reason_recorded", user_id=user_id, reason=reason)
    except Exception as e:
        logger.warning("cancellation_store_failed", error=str(e))

    html = """
    <!DOCTYPE html>
    <html>
    <head><title>Thank you — Nautilus</title>
    <style>
      body { font-family: Georgia, serif; background: #FAFAF8; display: flex;
             align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
      .card { background: white; border-radius: 12px; padding: 48px 56px;
              max-width: 480px; text-align: center; box-shadow: 0 8px 32px rgba(10,22,40,0.08); }
      h2 { color: #1A2A44; font-size: 24px; margin: 0 0 16px; }
      p { color: #666; font-size: 15px; line-height: 1.7; }
      a { color: #C6A85A; text-decoration: none; font-size: 14px; }
    </style></head>
    <body>
      <div class="card">
        <h2>Thank you for your feedback.</h2>
        <p>We read every response and use it to improve Nautilus.</p>
        <a href="https://get-nautilus.com">← Back to Nautilus</a>
      </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


# ── Freeform feedback submit ──────────────────────────────────────────────────

@router.post("/submit")
async def submit_feedback(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    user_id = body.get("user_id")
    feedback_type = body.get("type", "general")
    message = (body.get("message") or "").strip()

    if not message:
        raise HTTPException(400, "message required")
    if len(message) > 5000:
        raise HTTPException(400, "message too long")

    try:
        await db.execute(
            text("""
                CREATE TABLE IF NOT EXISTS feedback_submissions (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    user_id TEXT,
                    type TEXT NOT NULL,
                    message TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
        )
        await db.execute(
            text("INSERT INTO feedback_submissions (user_id, type, message) VALUES (:uid, :type, :msg)"),
            {"uid": user_id, "type": feedback_type, "msg": message},
        )
        await db.commit()
    except Exception as e:
        logger.warning("feedback_store_failed", error=str(e))

    try:
        asyncio.create_task(send_admin_notification(
            subject=f"💬 New Nautilus feedback — {feedback_type}",
            html=f"""
            <div style="font-family: Georgia, serif; padding: 32px; max-width: 480px;">
              <h2 style="color: #0A1628;">New feedback submission</h2>
              <p><strong>Type:</strong> {feedback_type}</p>
              <p><strong>User:</strong> {user_id or 'anonymous'}</p>
              <p><strong>Message:</strong></p>
              <blockquote style="border-left: 3px solid #C6A85A; padding-left: 16px; color: #444;">
                {message}
              </blockquote>
            </div>
            """,
        ))
    except Exception:
        pass

    return {"status": "received", "message": "Thank you. We read every message."}
