from __future__ import annotations

import smtplib
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
        self.last_error_message = ""

    @staticmethod
    def _validate_email_address(value: str, *, label: str) -> str:
        raw = str(value or "").strip()
        _, parsed = parseaddr(raw)
        if "@" not in parsed:
            raise ValueError(f"Invalid {label} email address")
        return parsed

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        try:
            self.last_error_message = ""
            if "gmail" in str(self.smtp_server).lower() and not str(self.sender_password or "").strip():
                self.last_error_message = (
                    "Gmail SMTP requires a valid App Password. "
                    "Enable 2-Step Verification and generate a Gmail App Password."
                )
                print(f"Email send failed to {to_email}: Gmail SMTP requires an App Password.")
                print("Tip: Enable 2-Step Verification on the sender Gmail account and generate an App Password.")
                return False

            recipient = str(to_email or "").strip()
            parsed_recipient = self._validate_email_address(recipient, label="recipient")
            parsed_sender = self._validate_email_address(self.sender_email, label="sender")

            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.sender_name} <{parsed_sender}>"
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
                    server.login(parsed_sender, self.sender_password)
                server.sendmail(parsed_sender, [parsed_recipient], message.as_string())

            return True
        except smtplib.SMTPAuthenticationError as exc:  # pragma: no cover - operational logging path
            self.last_error_message = (
                "SMTP authentication failed. Check SENDER_EMAIL and SENDER_PASSWORD. "
                "For Gmail, use a 16-character App Password."
            )
            print(f"Email send failed to {to_email}: SMTP authentication failed.")
            print("Tip: For Gmail, enable 2-Step Verification and use an App Password (16 characters).")
            print(f"Details: {exc}")
            return False
        except smtplib.SMTPServerDisconnected as exc:  # pragma: no cover - operational logging path
            self.last_error_message = (
                "SMTP server disconnected unexpectedly. Verify SMTP_SERVER, SMTP_PORT, "
                "and firewall/network access."
            )
            print(f"Email send failed to {to_email}: SMTP server disconnected unexpectedly.")
            print("Tip: Verify SMTP_SERVER/SMTP_PORT and check that your network/firewall allows SMTP.")
            print(f"Details: {exc}")
            return False
        except Exception as exc:  # pragma: no cover - operational logging path
            self.last_error_message = f"{exc.__class__.__name__}: {exc}"
            print(f"Email send failed to {to_email}: {exc.__class__.__name__}: {exc}")
            return False

    def send_otp_email(self, to_email: str, name: str, otp: str, validity_minutes: int = 10) -> bool:
        subject = "Verify your email - Global Supply Chain Management System"
        text_content = (
            f"Hi {name},\n\n"
            "You are creating a new Global Supply Chain Management System account.\n\n"
            "Account details:\n"
            f"- Name: {name}\n"
            f"- Email: {to_email}\n\n"
            "Use this OTP to complete signup:\n"
            f"{otp}\n\n"
            "Return to the app and enter this code to complete signup.\n\n"
            f"Code expires in {validity_minutes} minutes. Do not share this code.\n\n"
            "Thank you.\n"
            "Regards,\nGSCMS"
        )

        html_content = f"""
        <!DOCTYPE html>
        <html>
          <body style="font-family: Georgia, 'Times New Roman', serif; background: linear-gradient(180deg, #eef2ff 0%, #f8fafc 100%); margin: 0; padding: 28px;">
            <div style="max-width: 620px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #2563eb 100%); border-radius: 18px; padding: 24px 26px; color: #eef2ff; box-shadow: 0 14px 30px rgba(49, 46, 129, 0.22);">
                <div style="font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.9;">
                  GSCMS
                </div>
                <div style="font-size: 28px; font-weight: 700; margin-top: 10px; line-height: 1.2;">
                  Email verification
                </div>
                <div style="margin-top: 10px; font-size: 15px; line-height: 1.7; color: #c7d2fe;">
                  Complete your signup using the OTP below.
                </div>
              </div>

              <div style="background: #ffffff; border: 1px solid #d7def7; border-radius: 18px; padding: 26px; margin-top: 16px; box-shadow: 0 10px 24px rgba(99, 102, 241, 0.12);">
                <p style="margin: 0 0 12px; color: #0f172a; font-size: 18px;">
                  Hi <strong>{name}</strong>,
                </p>
                <p style="margin: 0 0 14px; color: #334155; line-height: 1.8; font-size: 15px;">
                  You are creating a new Global Supply Chain Management System account.
                </p>

                <div style="background: linear-gradient(180deg, #f5f7ff 0%, #eef2ff 100%); border: 1px solid #c7d2fe; border-radius: 14px; padding: 18px 20px; margin: 16px 0;">
                  <div style="font-weight: 700; color: #312e81; margin-bottom: 10px; font-size: 16px;">Account details</div>
                  <div style="color: #1f2937; line-height: 1.9; font-size: 15px;">Name: <strong>{name}</strong></div>
                  <div style="color: #1f2937; line-height: 1.9; font-size: 15px;">Email: <strong>{to_email}</strong></div>
                </div>

                <div style="margin: 18px 0; text-align: center;">
                  <div style="font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #6366f1; margin-bottom: 10px;">
                    Use this OTP to complete signup
                  </div>
                  <div style="display: inline-block; background: #eef2ff; border: 1px solid #818cf8; border-radius: 14px; padding: 16px 24px; font-size: 34px; letter-spacing: 8px; font-weight: 700; color: #3730a3;">
                    {otp}
                  </div>
                </div>

                <div style="background: linear-gradient(180deg, #eff6ff 0%, #f5f7ff 100%); border: 1px solid #bfdbfe; border-radius: 14px; padding: 16px 18px; margin: 16px 0;">
                  <div style="font-weight: 700; color: #1d4ed8; margin-bottom: 8px; font-size: 16px;">Verification notes</div>
                  <div style="color: #0f172a; line-height: 1.8; font-size: 15px;">
                    Return to the app and enter this code to complete signup.
                  </div>
                </div>

                <p style="margin: 0; color: #475569; line-height: 1.8; font-size: 15px;">
                  Code expires in {validity_minutes} minutes. Do not share this code.
                </p>

                <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #0f172a; line-height: 1.8; font-size: 15px;">
                  Thank you.<br/>
                  Regards,<br/>
                  <strong>GSCMS</strong>
                </div>
              </div>
            </div>
          </body>
        </html>
        """

        return self.send_email(to_email, subject, html_content, text_content)

    def send_welcome_email(self, to_email: str, name: str, role: str) -> bool:
        subject = "Welcome - Account created - Global Supply Chain Management System"
        text_content = (
            f"Hi {name},\n\n"
            "Your account is created and ready to use.\n\n"
            f"Role: {role}\n\n"
            "Thank you for creating account with Global Supply Chain Management System.\n"
            "Regards,\nGSCMS"
        )
        html_content = f"""
        <!DOCTYPE html>
        <html>
          <body style="font-family: Georgia, 'Times New Roman', serif; background: linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%); margin: 0; padding: 28px;">
            <div style="max-width: 620px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #7c2d12 0%, #c2410c 52%, #f59e0b 100%); border-radius: 18px; padding: 24px 26px; color: #fff7ed; box-shadow: 0 14px 30px rgba(194, 65, 12, 0.2);">
                <div style="font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.9;">
                  Welcome • GSCMS
                </div>
                <div style="font-size: 28px; font-weight: 700; margin-top: 10px; line-height: 1.2;">
                  Account created
                </div>
                <div style="margin-top: 10px; font-size: 15px; line-height: 1.7; color: #ffedd5;">
                  Your Global Supply Chain Management System account is ready for access.
                </div>
              </div>

              <div style="background: #ffffff; border: 1px solid #fed7aa; border-radius: 18px; padding: 26px; margin-top: 16px; box-shadow: 0 10px 24px rgba(245, 158, 11, 0.14);">
                <p style="margin: 0 0 12px; color: #111827; font-size: 18px;">
                  Hi <strong>{name}</strong>,
                </p>
                <p style="margin: 0 0 14px; color: #374151; line-height: 1.8; font-size: 15px;">
                  Your account is created and ready to use.
                </p>

                <div style="background: linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%); border: 1px solid #fdba74; border-radius: 14px; padding: 18px 20px; margin: 16px 0;">
                  <div style="font-weight: 700; color: #9a3412; margin-bottom: 10px; font-size: 16px;">Account summary</div>
                  <div style="color: #1f2937; line-height: 1.9; font-size: 15px;">Name: <strong>{name}</strong></div>
                  <div style="color: #1f2937; line-height: 1.9; font-size: 15px;">Email: <strong>{to_email}</strong></div>
                  <div style="color: #1f2937; line-height: 1.9; font-size: 15px;">Role: <strong>{role}</strong></div>
                </div>

                <div style="background: linear-gradient(180deg, #fff1f2 0%, #ffedd5 100%); border: 1px solid #fdba74; border-radius: 14px; padding: 16px 18px; margin: 16px 0;">
                  <div style="font-weight: 700; color: #c2410c; margin-bottom: 8px; font-size: 16px;">Welcome</div>
                  <div style="color: #0f172a; line-height: 1.8; font-size: 15px;">
                    Thank you for creating account with <strong>Global Supply Chain Management System</strong>.
                  </div>
                </div>

                <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #fde68a; color: #0f172a; line-height: 1.8; font-size: 15px;">
                  Thank you.<br/>
                  Regards,<br/>
                  <strong>GSCMS</strong>
                </div>
              </div>
            </div>
          </body>
        </html>
        """
        return self.send_email(to_email, subject, html_content, text_content)

    def send_guest_account_email(self, to_email: str, name: str, company: str, phone: str) -> bool:
        subject = "Guest account created - Global Supply Chain Management System"
        text_content = (
            f"Hi {name},\n\n"
            "Your guest account is successfully opened.\n\n"
            "Guest account details:\n"
            f"- Name: {name}\n"
            f"- Company: {company}\n"
            f"- Phone: {phone}\n"
            f"- Email: {to_email}\n\n"
            "Thank you for registering with Global Supply Chain Management System.\n\n"
            "You can now continue with Global Supply Chain Management System using your guest access.\n\n"
            "Regards,\nGSCMS"
        )
        html_content = f"""
        <!DOCTYPE html>
        <html>
          <body style="font-family: Georgia, 'Times New Roman', serif; background: linear-gradient(180deg, #ecfdf5 0%, #f8fafc 100%); margin: 0; padding: 28px;">
            <div style="max-width: 620px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #064e3b 0%, #0f766e 50%, #34d399 100%); border-radius: 18px; padding: 24px 26px; color: #ecfdf5; box-shadow: 0 14px 30px rgba(6, 95, 70, 0.2);">
                <div style="font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.88;">
                  GSCMS
                </div>
                <div style="font-size: 28px; font-weight: 700; margin-top: 10px; line-height: 1.2;">
                  Guest account confirmation
                </div>
                <div style="margin-top: 10px; font-size: 15px; line-height: 1.7; color: #d1fae5;">
                  Your guest account for the Global Supply Chain Management System is successfully opened.
                </div>
              </div>

              <div style="background: #ffffff; border: 1px solid #cce9dd; border-radius: 18px; padding: 26px; margin-top: 16px; box-shadow: 0 10px 24px rgba(16, 185, 129, 0.12);">
                <p style="margin: 0 0 12px; color: #0f172a; font-size: 18px;">
                  Hi <strong>{name}</strong>,
                </p>
                <p style="margin: 0 0 14px; color: #334155; line-height: 1.8; font-size: 15px;">
                  Thank you for registering with <strong>Global Supply Chain Management System</strong>. Your guest account is now active and ready to use.
                </p>

                <div style="background: linear-gradient(180deg, #f0fdf4 0%, #ecfdf5 100%); border: 1px solid #86efac; border-radius: 14px; padding: 18px 20px; margin: 16px 0;">
                  <div style="font-weight: 700; color: #166534; margin-bottom: 10px; font-size: 16px;">Guest account details</div>
                  <div style="color: #1f2937; line-height: 1.9; font-size: 15px;">Name: <strong>{name}</strong></div>
                  <div style="color: #1f2937; line-height: 1.9; font-size: 15px;">Company: <strong>{company}</strong></div>
                  <div style="color: #1f2937; line-height: 1.9; font-size: 15px;">Phone: <strong>{phone}</strong></div>
                  <div style="color: #1f2937; line-height: 1.9; font-size: 15px;">Email: <strong>{to_email}</strong></div>
                </div>

                <div style="background: linear-gradient(180deg, #ecfeff 0%, #f1f5f9 100%); border: 1px solid #bae6fd; border-radius: 14px; padding: 16px 18px; margin: 14px 0;">
                  <div style="font-weight: 700; color: #0f172a; margin-bottom: 8px; font-size: 16px;">Account status</div>
                  <div style="color: #0f172a; line-height: 1.8; font-size: 15px;">
                    Your guest account is created and ready. You can now continue with Global Supply Chain Management System using your guest access.
                  </div>
                </div>

                <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #0f172a; line-height: 1.8; font-size: 15px;">
                  Thank you.<br/>
                  Regards,<br/>
                  <strong>GSCMS</strong>
                </div>
              </div>
            </div>
          </body>
        </html>
        """
        return self.send_email(to_email, subject, html_content, text_content)

    def send_feedback_thank_you_email(self, to_email: str, name: str) -> bool:
        subject = "Feedback received - Global Supply Chain Management System"
        text_content = (
            f"Hi {name},\n\n"
            "Thank you for sharing your feedback with Global Supply Chain Management System.\n"
            "Your response has been received and our team will use it to improve the platform.\n\n"
            "Feedback details:\n"
            f"- Name: {name}\n"
            f"- Email: {to_email}\n\n"
            "What happens next:\n"
            "- Our team reviews your notes.\n"
            "- If we need more context, we may contact you.\n\n"
            "Thank you.\n"
            "Regards,\nGSCMS"
        )
        html_content = f"""
        <!DOCTYPE html>
        <html>
          <body style="font-family: Georgia, 'Times New Roman', serif; background: linear-gradient(180deg, #fff1f2 0%, #fff7ed 100%); margin: 0; padding: 28px;">
            <div style="max-width: 620px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #7f1d1d 0%, #be123c 52%, #ea580c 100%); border-radius: 18px; padding: 24px 26px 20px; color: #fff1f2; box-shadow: 0 14px 30px rgba(190, 24, 93, 0.2);">
                <div style="font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.9;">
                  GSCMS
                </div>
                <div style="font-size: 28px; font-weight: 700; margin-top: 10px; line-height: 1.2;">
                  Feedback received
                </div>
              </div>

              <div style="background: #ffffff; border-radius: 18px; padding: 26px; border: 1px solid #fecdd3; margin-top: 16px; box-shadow: 0 10px 24px rgba(251, 113, 133, 0.12);">
                <p style="margin: 0 0 10px; color: #111827; font-size: 18px;">
                  Hi <strong>{name}</strong>,
                </p>

                <div style="background: linear-gradient(180deg, #fff1f2 0%, #ffedd5 100%); border: 1px solid #fda4af; border-radius: 14px; padding: 16px 18px; margin: 14px 0;">
                  <div style="font-weight: 700; color: #9f1239; margin-bottom: 8px; font-size: 16px;">Thank you!</div>
                  <div style="color: #0f172a; line-height: 1.8; font-size: 15px;">
                    Your feedback has been recorded. Our team will use it to improve the platform.
                  </div>
                </div>

                <div style="background: #fffaf5; border: 1px solid #fdba74; border-radius: 14px; padding: 16px 18px; margin: 16px 0;">
                  <div style="font-weight: 700; color: #c2410c; margin-bottom: 10px; font-size: 16px;">Submitted details</div>
                  <div style="color: #1f2937; line-height: 1.9; font-size: 15px;">Name: <strong>{name}</strong></div>
                  <div style="color: #1f2937; line-height: 1.9; font-size: 15px;">Email: <strong>{to_email}</strong></div>
                </div>

                <div style="margin-top: 14px;">
                  <div style="font-weight: 700; color: #111827; margin-bottom: 8px; font-size: 16px;">What happens next</div>
                  <ul style="margin: 0; padding-left: 18px; color: #374151; line-height: 1.85; font-size: 15px;">
                    <li>Our team reviews your notes and prioritizes improvements.</li>
                    <li>If we need more context, we may contact you.</li>
                  </ul>
                </div>

                <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #0f172a; font-size: 15px; line-height: 1.8;">
                  Thank you.<br/>
                  Regards,<br/>
                  <strong>GSCMS</strong>
                </div>

                <div style="margin-top: 14px; color: #6b7280; font-size: 12.5px; line-height: 1.6;">
                  If you didn't submit this feedback, you can ignore this email.
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
        self.last_error_message = ""
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
