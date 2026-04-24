from fastapi import APIRouter, Depends
from typing import Any
import structlog

from app.api.auth_utils import get_current_user_optional
from app.models.db_models import User

logger = structlog.get_logger()
router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post("/event")
async def log_event(
    data: dict[str, Any],
    current_user: User | None = Depends(get_current_user_optional),
):
    """Log a client-side analytics event (fire-and-forget)."""
    logger.info(
        "client_event",
        event=data.get("event"),
        lot_id=data.get("lot_id"),
        user_id=str(current_user.id) if current_user else "anon",
    )
    return {"ok": True}
