from __future__ import annotations

import argparse
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import parseaddr

import smtplib

from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check SMTP connectivity and optionally send a test email.")
    parser.add_argument("--to", dest="to_email", required=True, help="Recipient email address.")
    parser.add_argument("--subject", default="SMTP test - Global Supply Chain", help="Subject line.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only connect + (optional) login + NOOP; do not send an email.",
    )
    parser.add_argument(
        "--no-login",
        action="store_true",
        help="Skip SMTP AUTH even if SENDER_PASSWORD is set (useful for open relays / local dev).",
    )
    return parser.parse_args()


def _validate_recipient(email: str) -> str:
    raw = str(email or "").strip()
    _, parsed = parseaddr(raw)
    if "@" not in parsed:
        raise ValueError("Invalid recipient email address")
    return parsed


def _build_message(*, sender_name: str, sender_email: str, to_email: str, subject: str) -> str:
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{sender_name} <{sender_email}>"
    message["To"] = to_email

    text_body = (
        "SMTP connectivity test\n\n"
        "If you received this, your SMTP relay is configured correctly.\n"
    )
    html_body = (
        "<html><body style='font-family: Arial, sans-serif;'>"
        "<h3>SMTP connectivity test</h3>"
        "<p>If you received this, your SMTP relay is configured correctly.</p>"
        "</body></html>"
    )

    message.attach(MIMEText(text_body, "plain", "utf-8"))
    message.attach(MIMEText(html_body, "html", "utf-8"))
    return message.as_string()


def main() -> int:
    args = _parse_args()
    settings = get_settings()

    to_email = _validate_recipient(args.to_email)

    smtp_server = settings.smtp_server
    smtp_port = settings.smtp_port
    sender_email = settings.sender_email
    sender_password = settings.sender_password
    sender_name = settings.sender_name

    if not smtp_server or not smtp_port:
        print("Missing SMTP_SERVER/SMTP_PORT in env.")
        return 2
    if not sender_email:
        print("Missing SENDER_EMAIL in env.")
        return 2

    server_label = f"{smtp_server}:{smtp_port}"
    use_ssl = int(smtp_port) == 465

    if settings.mock_email_delivery:
        print("MOCK_EMAIL_DELIVERY=true is set; this script tests real SMTP.")
        print("Set MOCK_EMAIL_DELIVERY=false and rerun to test the relay.")
        return 2

    if "gmail" in str(smtp_server).lower() and not sender_password.strip() and not args.no_login:
        print("FAIL: Gmail SMTP requires an App Password (SENDER_PASSWORD).")
        print("Tip: Enable 2-Step Verification and generate a 16-character App Password.")
        return 2

    if "gmail" in str(smtp_server).lower() and sender_password and len(sender_password.strip()) < 12:
        print("Note: Gmail typically requires an App Password (16 chars) for SMTP AUTH.")

    smtp_client = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
    try:
        with smtp_client(smtp_server, smtp_port, timeout=20) as client:
            client.ehlo()
            if not use_ssl and client.has_extn("starttls"):
                client.starttls()
                client.ehlo()

            if sender_password and not args.no_login:
                client.login(sender_email, sender_password)

            # Basic liveness check.
            client.noop()

            if args.dry_run:
                print(f"OK: Connected to {server_label} (dry-run).")
                return 0

            raw_message = _build_message(
                sender_name=sender_name,
                sender_email=sender_email,
                to_email=to_email,
                subject=args.subject,
            )
            client.sendmail(sender_email, [to_email], raw_message)

        print(f"OK: Sent test email via {server_label} to {to_email}.")
        return 0

    except Exception as exc:
        print(f"FAIL: SMTP test failed for {server_label}: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
