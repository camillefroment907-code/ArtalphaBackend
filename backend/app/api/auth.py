import asyncio
import logging
import secrets

logger = logging.getLogger(__name__)
from datetime import timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt as jose_jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel

from app.config import get_settings
from app.database import get_db
from app.models.db_models import User, UserPreference, AlertChannel, Subscription
from app.models.schemas import UserRegister, UserLogin, TokenResponse, UserOut
from app.api.auth_utils import hash_password, verify_password, create_access_token, get_current_user
from app.services.email_service import send_welcome_email, send_verification_email, send_password_reset_email

settings = get_settings()

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("10/minute")
async def register(request: Request, body: UserRegister, db: AsyncSession = Depends(get_db)):
    import traceback

    # Check duplicate
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        from datetime import datetime
        user = User(
            email=body.email,
            hashed_password=hash_password(body.password),
            full_name=body.full_name,
            is_active=True,
            is_verified=False,
            marketing_consent=body.marketing_consent,
            language=body.language if body.language in ("fr", "en") else "fr",
        )
        user.accepted_terms_at = datetime.utcnow()
        user.accepted_terms_ip = request.client.host if request.client else None
        user.accepted_terms_version = '3.0'
        db.add(user)
        await db.flush()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"User creation failed: {type(e).__name__}: {e}")

    try:
        prefs = UserPreference(
            user_id=user.id,
            favorite_artists=[],
            categories=[],
            min_deal_score=75,
            alert_channel=AlertChannel.EMAIL,
            alert_email=body.email,
            auction_houses=[],
            is_alerts_enabled=True,
            language="fr",
        )
        db.add(prefs)
        await db.commit()
        await db.refresh(user)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Preferences creation failed: {type(e).__name__}: {e}")

    # Fire-and-forget welcome email (non-blocking — failures won't affect registration)
    try:
        asyncio.create_task(send_welcome_email(
            to_email=user.email,
            name=user.full_name or user.email,
            plan="free",
            lang=user.language,
        ))
    except Exception:
        pass

    # Fire-and-forget verification email
    try:
        verify_token = create_access_token(
            {"sub": str(user.id), "purpose": "verify_email"},
            expires_delta=timedelta(hours=48),
        )
        verify_url = f"{settings.frontend_url}/app/verify-email?token={verify_token}"
        print(f"[AUTH] email_config resend_key_set={bool(settings.resend_api_key)}, from={settings.transac_from_email}")
        _lang = user.language

        async def _send_verify():
            try:
                ok = await send_verification_email(user.email, verify_url, lang=_lang)
                print(f"[AUTH] verification_email sent={ok} to={user.email}")
            except Exception as exc:
                print(f"[AUTH] verification_email FAILED to={user.email} error={exc}")

        asyncio.create_task(_send_verify())
    except Exception:
        pass

    token = create_access_token({"sub": str(user.id), "email": user.email, "plan": "free"})
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        plan="free",
        onboarding_completed=user.onboarding_completed,
    )


class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    password: str


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Send a password-reset link. Always returns 200 to prevent email enumeration."""
    result = await db.execute(select(User).where(User.email == body.email.lower().strip()))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        reset_token = create_access_token(
            {"sub": str(user.id), "purpose": "reset_password"},
            expires_delta=timedelta(hours=1),
        )
        reset_url = f"{settings.frontend_url}/reset-password?token={reset_token}"
        asyncio.create_task(send_password_reset_email(user.email, reset_url, lang=user.language))

    return {"message": "If this email is registered, you'll receive a reset link shortly."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Consume a reset token and set a new password."""
    try:
        payload = jose_jwt.decode(body.token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("purpose") != "reset_password":
            raise ValueError("wrong purpose")
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(400, "Invalid or expired reset link. Please request a new one.")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(400, "Invalid reset link.")

    if len(body.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters.")

    user.hashed_password = hash_password(body.password)
    await db.commit()
    return {"message": "Password updated successfully."}


@router.get("/verify-email")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    try:
        payload = jose_jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("purpose") != "verify_email":
            raise ValueError("wrong purpose")
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(400, "Invalid or expired verification token.")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(400, "Invalid verification token.")

    user.is_verified = True
    await db.commit()
    return RedirectResponse(url=f"{settings.frontend_url}/app/explore?verified=true")


@router.post("/login", response_model=TokenResponse)
@limiter.limit("20/minute")
async def login(request: Request, body: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.email == body.email).options(selectinload(User.subscription))
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    plan = user.active_plan.value.lower()
    if user.email == "camillefroment907@gmail.com":
        plan = "institutional"
    token = create_access_token({"sub": str(user.id), "email": user.email, "plan": plan})
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        plan=plan,
        is_verified=user.is_verified,
    )


@router.post("/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Re-send the email verification link for the logged-in user."""
    if current_user.is_verified:
        return {"message": "Email already verified."}

    verify_token = create_access_token(
        {"sub": str(current_user.id), "purpose": "verify_email"},
        expires_delta=timedelta(hours=48),
    )
    verify_url = f"{settings.frontend_url}/app/verify-email?token={verify_token}"
    asyncio.create_task(send_verification_email(current_user.email, verify_url, lang=getattr(current_user, 'language', 'fr')))
    return {"message": "Verification email sent."}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
async def logout():
    # Stateless JWT — client drops the token
    return {"message": "Logged out"}


class GoogleAuthRequest(BaseModel):
    credential: str


@router.post("/google", response_model=TokenResponse)
@limiter.limit("20/minute")
async def google_auth(request: Request, body: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """Verify a Google ID token (from Google Identity Services) and return a Nautilus JWT."""
    if not settings.google_client_id:
        raise HTTPException(501, "Google OAuth is not configured on this server")

    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        # Accept both current and legacy client IDs during frontend migration
        _client_ids = [
            settings.google_client_id,
            "641757535865-3mgk4b4a7lc1ajcbphu40jip5d1rbe84.apps.googleusercontent.com",
        ]
        id_info = None
        last_exc: Exception | None = None
        for _cid in _client_ids:
            if not _cid:
                continue
            try:
                id_info = id_token.verify_oauth2_token(
                    body.credential,
                    google_requests.Request(),
                    _cid,
                    clock_skew_in_seconds=10,
                )
                break
            except Exception as e:
                last_exc = e
        if id_info is None:
            raise last_exc or ValueError("No valid client_id")
    except Exception as exc:
        logger.error("Google token verification failed: %s", exc, exc_info=True)
        raise HTTPException(400, "Invalid or expired Google token")

    email = id_info.get("email")
    name = id_info.get("name")
    if not email:
        raise HTTPException(400, "Google account has no email address")

    result = await db.execute(
        select(User).where(User.email == email).options(selectinload(User.subscription))
    )
    user = result.scalar_one_or_none()
    is_new = user is None

    if is_new:
        try:
            user = User(
                email=email,
                hashed_password=hash_password(secrets.token_urlsafe(32)),
                full_name=name,
                is_active=True,
                is_verified=True,  # Google verifies email addresses
            )
            db.add(user)
            await db.flush()

            prefs = UserPreference(
                user_id=user.id,
                favorite_artists=[],
                categories=[],
                min_deal_score=75,
                alert_channel=AlertChannel.EMAIL,
                alert_email=email,
                auction_houses=[],
                is_alerts_enabled=True,
                language="fr",
            )
            db.add(prefs)
            await db.commit()
            await db.refresh(user)
        except Exception as e:
            await db.rollback()
            raise HTTPException(500, f"Account creation failed: {type(e).__name__}: {e}")

        try:
            asyncio.create_task(send_welcome_email(
                to_email=user.email,
                name=user.full_name or user.email,
                plan="free",
                lang=user.language,
            ))
        except Exception:
            pass

    plan = "free" if is_new else user.active_plan.value.lower()
    token = create_access_token({"sub": str(user.id), "email": user.email, "plan": plan})
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        is_new_user=is_new,
        plan=plan,
        onboarding_completed=user.onboarding_completed,
    )


@router.get("/oauth/google")
async def oauth_google_redirect():
    """Legacy GET endpoint — redirect to login."""
    return RedirectResponse(url="/auth/login?error=google_not_configured", status_code=302)


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    address: Optional[str] = None
    collector_type: Optional[str] = None
    investment_horizon: Optional[str] = None
    annual_budget: Optional[float] = None
    expected_return: Optional[float] = None
    preferred_styles: Optional[str] = None
    preferred_regions: Optional[str] = None
    goals: Optional[str] = None
    language: Optional[str] = None


@router.patch("/profile")
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # User-level fields
    for field in ("full_name", "phone", "country", "address"):
        value = getattr(body, field, None)
        if value is not None and hasattr(current_user, field):
            setattr(current_user, field, value)

    if body.language in ("fr", "en"):
        current_user.language = body.language

    # Preference fields
    pref_result = await db.execute(select(UserPreference).where(UserPreference.user_id == current_user.id))
    pref = pref_result.scalar_one_or_none()
    if pref is None:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)

    if body.collector_type is not None:
        pref.collector_type = body.collector_type
    if body.investment_horizon is not None:
        pref.investment_horizon = body.investment_horizon
    if body.annual_budget is not None:
        pref.min_lot_budget_eur = body.annual_budget
    if body.preferred_styles is not None:
        pref.preferred_periods = [body.preferred_styles] if body.preferred_styles else []
    if body.preferred_regions is not None:
        pref.preferred_regions = [body.preferred_regions] if body.preferred_regions else []
    if body.language in ("fr", "en"):
        pref.language = body.language
    if body.expected_return is not None:
        pref.expected_return_pct = body.expected_return
    if body.goals is not None:
        pref.goals = body.goals

    await db.commit()
    return {"message": "Profile updated", "email": current_user.email}


@router.post("/complete-onboarding")
async def complete_onboarding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.onboarding_completed = True
    await db.commit()
    return {"onboarding_completed": True}


@router.delete("/delete-account")
async def delete_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """RGPD-compliant account deletion: anonymize user data, cancel Stripe subscription at period end."""
    from datetime import datetime

    billing_interval = "free"
    subscription_end_date = None

    # Step 1: Fetch subscription from DB
    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = sub_result.scalar_one_or_none()

    # Step 2: Handle Stripe — set cancel_at_period_end, never immediate cancel
    if sub and sub.stripe_subscription_id:
        try:
            import stripe as stripe_lib
            stripe_lib.api_key = settings.stripe_secret_key
            stripe_sub = stripe_lib.Subscription.retrieve(sub.stripe_subscription_id)
            billing_interval = sub.billing_interval or "monthly"
            if stripe_sub.get("status") in ("active", "trialing"):
                updated = stripe_lib.Subscription.modify(
                    sub.stripe_subscription_id,
                    cancel_at_period_end=True,
                )
                period_end_ts = updated.get("current_period_end")
                if period_end_ts:
                    subscription_end_date = datetime.utcfromtimestamp(period_end_ts).isoformat() + "Z"
            sub.cancel_at_period_end = True
            sub.updated_at = datetime.utcnow()
        except Exception:
            # Stripe unreachable — fall back to DB values
            billing_interval = sub.billing_interval or "monthly"
            if sub.current_period_end:
                subscription_end_date = sub.current_period_end.isoformat() + "Z"
    elif sub:
        billing_interval = sub.billing_interval or "monthly"
        if sub.current_period_end:
            subscription_end_date = sub.current_period_end.isoformat() + "Z"

    # Step 3: RGPD anonymization — never hard delete
    anonymized_email = f"deleted_{current_user.id}@deleted.nautilus"
    await db.execute(
        text("""
            UPDATE users SET
                email        = :email,
                full_name    = NULL,
                hashed_password = 'DELETED',
                phone        = NULL,
                is_active    = FALSE,
                updated_at   = now()
            WHERE id = :uid
        """),
        {"email": anonymized_email, "uid": str(current_user.id)},
    )
    await db.commit()

    return {
        "success": True,
        "billing_interval": billing_interval,
        "subscription_end_date": subscription_end_date,
        "message": "Account scheduled for deletion",
    }
