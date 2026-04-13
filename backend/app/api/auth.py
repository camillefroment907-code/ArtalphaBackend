import asyncio
from datetime import timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt as jose_jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel

from app.config import get_settings
from app.database import get_db
from app.models.db_models import User, UserPreference, AlertChannel
from app.models.schemas import UserRegister, UserLogin, TokenResponse, UserOut
from app.api.auth_utils import hash_password, verify_password, create_access_token, get_current_user
from app.services.email_service import send_welcome_email, send_verification_email

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
        user = User(
            email=body.email,
            hashed_password=hash_password(body.password),
            full_name=body.full_name,
            is_active=True,
            is_verified=False,
        )
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
            lang="fr",
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
        asyncio.create_task(send_verification_email(user.email, verify_url))
    except Exception:
        pass

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
    )


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
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
async def logout():
    # Stateless JWT — client drops the token
    return {"message": "Logged out"}


@router.get("/oauth/google")
async def oauth_google_redirect():
    """Google OAuth — not configured. Redirect to login with error."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/auth/login?error=google_not_configured", status_code=302)


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    address: Optional[str] = None
    collector_type: Optional[str] = None
    investment_budget: Optional[str] = None
    investment_horizon: Optional[str] = None
    preferred_categories: Optional[List[str]] = None


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
    if body.preferred_categories is not None:
        pref.categories = body.preferred_categories

    await db.commit()
    return {"message": "Profile updated", "email": current_user.email}
