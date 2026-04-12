import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.models.db_models import User, UserPreference, AlertChannel
from app.models.schemas import UserRegister, UserLogin, TokenResponse, UserOut
from app.api.auth_utils import hash_password, verify_password, create_access_token, get_current_user
from app.services.email_service import send_welcome_email

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

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
    )


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
