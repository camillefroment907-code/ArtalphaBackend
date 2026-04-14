from fastapi import APIRouter

router = APIRouter()


@router.post("/contact")
async def contact_form(body: dict):
    from app.services.email_service import _send
    try:
        await _send(
            to_email="contact@get-nautilus.com",
            subject=f"[Nautilus Contact] {body.get('subject', 'General')} — {body.get('name')}",
            html=f"""
            <p><strong>From:</strong> {body.get('name')} ({body.get('email')})</p>
            <p><strong>Subject:</strong> {body.get('subject')}</p>
            <p><strong>Message:</strong></p>
            <p>{body.get('message')}</p>
            """,
            from_email="noreply@get-nautilus.com",
        )
    except Exception:
        pass
    return {"message": "sent"}
