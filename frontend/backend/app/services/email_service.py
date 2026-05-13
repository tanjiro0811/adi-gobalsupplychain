from __future__ import annotations

import smtplib
from datetime import datetime, timezone
from email.utils import parseaddr
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
            if "gmail" in str(self.smtp_server).lower() and not str(self.sender_password or "").strip():
                print(f"Email send failed to {to_email}: Gmail SMTP requires an App Password.")
                print("Tip: Enable 2-Step Verification on the sender Gmail account and generate an App Password.")
                return False

            recipient = str(to_email or "").strip()
            _, parsed_recipient = parseaddr(recipient)
            if "@" not in parsed_recipient:
                raise ValueError("Invalid recipient email address")

            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.sender_name} <{self.sender_email}>"
            message["To"] = recipient

            if text_content:
                message.attach(MIMEText(text_content, "plain", "utf-8"))

            message.attach(MIMEText(html_content, "html", "utf-8"))

            use_ssl = self.smtp_port == 465
            smtp_client = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP

            with smtp_client(self.smtp_server, self.smtp_port, timeout=20) as server:
                server.ehlo()
                if not use_ssl and server.has_extn("starttls"):
                    server.starttls()
                    server.ehlo()

                if self.sender_password:
                    server.login(self.sender_email, self.sender_password)
                server.sendmail(self.sender_email, [parsed_recipient], message.as_string())

            return True
        except smtplib.SMTPAuthenticationError as exc:  # pragma: no cover - operational logging path
            print(f"Email send failed to {to_email}: SMTP authentication failed.")
            print("Tip: For Gmail, enable 2-Step Verification and use an App Password (16 characters).")
            print(f"Details: {exc}")
            return False
        except smtplib.SMTPServerDisconnected as exc:  # pragma: no cover - operational logging path
            print(f"Email send failed to {to_email}: SMTP server disconnected unexpectedly.")
            print("Tip: Verify SMTP_SERVER/SMTP_PORT and check that your network/firewall allows SMTP.")
            print(f"Details: {exc}")
            return False
        except Exception as exc:  # pragma: no cover - operational logging path
            print(f"Email send failed to {to_email}: {exc.__class__.__name__}: {exc}")
            return False

    def send_otp_email(self, to_email: str, name: str, otp: str, validity_minutes: int = 10) -> bool:
        subject = "Verify your email - Global Supply Chain"
        text_content = (
            f"Hi {name},\n\n"
            "You are creating a new Global Supply Chain account.\n\n"
            "Account details:\n"
            f"- Name: {name}\n"
            f"- Email: {to_email}\n\n"
            "Your OTP code:\n"
            f"{otp}\n\n"
            "Next steps:\n"
            "1) Return to the app.\n"
            "2) Enter this 6-digit OTP to complete signup.\n\n"
            f"This code will expire in {validity_minutes} minutes.\n"
            "If you did not request this code, please ignore this email."
        )

        html_content = f"""
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 24px;">
            <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
              <h2 style="margin-top: 0; color: #111827;">Email verification</h2>
              <p style="color: #374151;">Hi <strong>{name}</strong>,</p>
              <p style="color: #374151; margin-bottom: 12px;">You are creating a new Global Supply Chain account.</p>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin: 14px 0;">
                <p style="margin: 0 0 8px; color: #111827; font-weight: 600;">Account details</p>
                <p style="margin: 0; color: #374151;">Name: <strong>{name}</strong></p>
                <p style="margin: 4px 0 0; color: #374151;">Email: <strong>{to_email}</strong></p>
              </div>
              <p style="color: #374151; margin-bottom: 8px;">Use this OTP to complete signup:</p>
              <div style="font-size: 32px; letter-spacing: 8px; font-weight: 700; color: #2563eb; margin: 18px 0;">{otp}</div>
              <p style="color: #6b7280; margin: 0 0 10px;">Return to the app and enter this code to complete signup.</p>
              <p style="color: #6b7280; margin-bottom: 0;">Code expires in {validity_minutes} minutes. Do not share this code.</p>
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

    def send_feedback_thank_you_email(self, to_email: str, name: str) -> bool:
        subject = "Thanks for your feedback - Global Supply Chain"
        text_content = (
            f"Hi {name},\n\n"
            "Thank you for sharing your feedback with Global Supply Chain.\n"
            "Your response has been received and our team will use it to improve the platform.\n\n"
            "What happens next:\n"
            "- Our team reviews your notes.\n"
            "- If we need more context, we may contact you.\n\n"
            "Regards,\nGlobal Supply Chain Team"
        )
        html_content = f"""
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 24px;">
            <div style="max-width: 620px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #0a1628 0%, #10324a 55%, #1b6b8a 100%); border-radius: 14px; padding: 22px 22px 18px; color: #e5faff;">
                <div style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.9;">
                  Global Supply Chain
                </div>
                <div style="font-size: 22px; font-weight: 800; margin-top: 8px;">
                  Feedback received
                </div>
              </div>

              <div style="background: #ffffff; border-radius: 14px; padding: 22px; border: 1px solid #e5e7eb; margin-top: 14px;">
                <p style="margin: 0 0 10px; color: #111827; font-size: 16px;">
                  Hi <strong>{name}</strong>,
                </p>

                <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 14px 14px; margin: 12px 0;">
                  <div style="font-weight: 700; color: #0c4a6e; margin-bottom: 6px;">Thank you!</div>
                  <div style="color: #0f172a; line-height: 1.6;">
                    Your feedback has been recorded. Our team will use it to improve the platform.
                  </div>
                </div>

                <div style="margin-top: 14px;">
                  <div style="font-weight: 700; color: #111827; margin-bottom: 8px;">What happens next</div>
                  <ul style="margin: 0; padding-left: 18px; color: #374151; line-height: 1.75;">
                    <li>Our team reviews your notes and prioritizes improvements.</li>
                    <li>If we need more context, we may contact you.</li>
                  </ul>
                </div>

                <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12.5px; line-height: 1.6;">
                  If you didn’t submit this feedback, you can ignore this email.
                </div>
              </div>
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

    if settings.mock_email_delivery:
        return MockEmailService()

    return EmailService()
