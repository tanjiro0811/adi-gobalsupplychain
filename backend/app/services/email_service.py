from __future__ import annotations

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import get_settings


class EmailService:
    """Service for sending transactional emails."""

    def __init__(self) -> None:
        settings = get_settings()
        self.smtp_server = settings.smtp_server
        self.smtp_port = settings.smtp_port
        self.sender_email = settings.sender_email
        self.sender_password = settings.sender_password
        self.sender_name = settings.sender_name

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.sender_name} <{self.sender_email}>"
            message["To"] = to_email

            if text_content:
                message.attach(MIMEText(text_content, "plain"))

            message.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=20) as server:
                server.starttls()
                if self.sender_password:
                    server.login(self.sender_email, self.sender_password)
                server.send_message(message)

            return True
        except Exception as exc:  # pragma: no cover - operational logging path
            print(f"Email send failed: {exc}")
            return False

    def send_otp_email(self, to_email: str, name: str, otp: str, validity_minutes: int = 10) -> bool:
        subject = "Verify your email - Global Supply Chain"
        text_content = (
            f"Hi {name},\n\n"
            f"Your verification code is: {otp}\n"
            f"This code will expire in {validity_minutes} minutes.\n\n"
            "If you did not request this code, please ignore this email."
        )

        html_content = f"""
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 24px;">
            <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
              <h2 style="margin-top: 0; color: #111827;">Email verification</h2>
              <p style="color: #374151;">Hi <strong>{name}</strong>,</p>
              <p style="color: #374151;">Use this verification code to complete signup:</p>
              <div style="font-size: 32px; letter-spacing: 8px; font-weight: 700; color: #2563eb; margin: 18px 0;">{otp}</div>
              <p style="color: #6b7280; margin-bottom: 0;">Code expires in {validity_minutes} minutes.</p>
            </div>
          </body>
        </html>
        """

        return self.send_email(to_email, subject, html_content, text_content)

    def send_welcome_email(self, to_email: str, name: str, role: str) -> bool:
        subject = "Welcome to Global Supply Chain"
        text_content = (
            f"Hi {name},\n\n"
            "Your account has been created successfully.\n"
            f"Role: {role}\n\n"
            "You can now sign in and access your dashboard."
        )
        html_content = f"""
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 24px;">
            <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
              <h2 style="margin-top: 0; color: #111827;">Welcome</h2>
              <p style="color: #374151;">Hi <strong>{name}</strong>,</p>
              <p style="color: #374151;">Your account is ready.</p>
              <p style="color: #374151;">Role: <strong>{role}</strong></p>
            </div>
          </body>
        </html>
        """
        return self.send_email(to_email, subject, html_content, text_content)


class MockEmailService(EmailService):
    """Development email service that prints instead of sending."""

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        print("\n" + "=" * 60)
        print("EMAIL MOCK")
        print("=" * 60)
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print("-" * 60)
        print(text_content or "No plain text body")
        print("=" * 60 + "\n")
        return True


def get_email_service() -> EmailService:
    settings = get_settings()
    env = settings.app_env.lower()

    if settings.mock_email_delivery or env == "development":
        return MockEmailService()

    # If credentials are not configured, force mock mode to avoid runtime SMTP failures.
    if not os.getenv("SENDER_PASSWORD") and not settings.sender_password:
        return MockEmailService()

    return EmailService()
