"""Django email backend that sends via the Resend HTTP API (port 443)
instead of raw SMTP, so it isn't affected by Railway blocking outbound
SMTP traffic (see STATE.md "Known issues" for the incident this fixes).
"""
import logging

import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


class ResendEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        api_key = settings.RESEND_API_KEY
        sent_count = 0
        for message in email_messages:
            payload = {
                "from": message.from_email,
                "to": message.to,
                "subject": message.subject,
                "text": message.body,
            }
            if message.cc:
                payload["cc"] = message.cc
            if message.bcc:
                payload["bcc"] = message.bcc

            try:
                response = requests.post(
                    RESEND_API_URL,
                    headers={"Authorization": f"Bearer {api_key}"},
                    json=payload,
                    timeout=settings.EMAIL_TIMEOUT,
                )
                response.raise_for_status()
                sent_count += 1
            except requests.RequestException:
                logger.exception("Resend API send failed for %s", message.to)
                if not self.fail_silently:
                    raise
        return sent_count
