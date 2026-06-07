"""
backend/app/utils/slack.py
Utilitaire Slack Incoming Webhook — fire-and-forget, jamais bloquant.
"""

import httpx
import os
import logging

logger = logging.getLogger(__name__)

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")


async def send_slack(blocks: list) -> None:
    """
    Envoie un message Slack via Incoming Webhook.
    Ne lève jamais d'exception — les notifications ne doivent jamais bloquer
    le flux principal.
    """
    if not SLACK_WEBHOOK_URL:
        logger.warning("SLACK_WEBHOOK_URL non définie — notification Slack ignorée")
        return

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                SLACK_WEBHOOK_URL,
                json={"blocks": blocks},
            )
            if resp.status_code != 200:
                logger.error(
                    f"Slack webhook erreur {resp.status_code}: {resp.text}"
                )
    except Exception as e:
        logger.error(f"Slack notification échouée: {e}")
