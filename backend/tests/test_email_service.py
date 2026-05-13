from __future__ import annotations

import smtplib

import pytest

from app.services.email_service import EmailService


class RecordingEmailService(EmailService):
    def __init__(self) -> None:
        super().__init__()
        self.calls: list[tuple[str, str, str, str | None]] = []

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str | None = None,
    ) -> bool:
        self.calls.append((to_email, subject, html_content, text_content))
        return True


def test_send_email_uses_starttls_login_and_send(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple] = []

    class FakeSMTP:
        def __init__(self, host: str, port: int, timeout: int = 20) -> None:
            calls.append(("connect", host, port, timeout))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb) -> bool:
            return False

        def ehlo(self) -> None:
            calls.append(("ehlo",))

        def has_extn(self, name: str) -> bool:
            calls.append(("has_extn", name))
            return name == "starttls"

        def starttls(self) -> None:
            calls.append(("starttls",))

        def login(self, email: str, password: str) -> None:
            calls.append(("login", email, bool(password)))

        def sendmail(self, sender: str, recipients: list[str], message: str) -> None:
            calls.append(
                (
                    "sendmail",
                    sender,
                    tuple(recipients),
                    "Subject: Test Subject" in message,
                    "Content-Type: multipart/alternative" in message,
                )
            )

    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)

    service = EmailService()

    assert service.send_email("user@example.com", "Test Subject", "<b>Hello</b>", "Hello") is True
    assert calls == [
        ("connect", "smtp.gmail.com", 587, 20),
        ("ehlo",),
        ("has_extn", "starttls"),
        ("starttls",),
        ("ehlo",),
        ("login", service.sender_email, True),
        ("sendmail", service.sender_email, ("user@example.com",), True, True),
    ]


def test_send_email_rejects_invalid_recipient() -> None:
    service = EmailService()

    assert service.send_email("not-an-email", "Test", "<b>Hello</b>", "Hello") is False
    assert service.last_error_message == "ValueError: Invalid recipient email address"


def test_send_email_rejects_invalid_sender(monkeypatch: pytest.MonkeyPatch) -> None:
    service = EmailService()
    monkeypatch.setattr(service, "sender_email", "invalid-sender")

    assert service.send_email("user@example.com", "Test", "<b>Hello</b>", "Hello") is False
    assert service.last_error_message == "ValueError: Invalid sender email address"


def test_template_methods_generate_expected_content() -> None:
    service = RecordingEmailService()

    assert service.send_otp_email("user@example.com", "Test User", "123456", validity_minutes=10) is True
    assert service.send_welcome_email("user@example.com", "Test User", "admin") is True
    assert service.send_guest_account_email("user@example.com", "Test User", "Test Co", "1234567890") is True
    assert service.send_feedback_thank_you_email("user@example.com", "Test User") is True

    assert len(service.calls) == 4

    otp_call = service.calls[0]
    assert otp_call[0] == "user@example.com"
    assert "Verify your email" in otp_call[1]
    assert "123456" in otp_call[2]
    assert otp_call[3] is not None and "Code expires in 10 minutes" in otp_call[3]

    welcome_call = service.calls[1]
    assert "Account created" in welcome_call[1]
    assert "Role: admin" in (welcome_call[3] or "")

    guest_call = service.calls[2]
    assert "Guest account created" in guest_call[1]
    assert "Test Co" in guest_call[2]
    assert "1234567890" in guest_call[2]

    feedback_call = service.calls[3]
    assert "Feedback received" in feedback_call[1]
    assert "What happens next" in feedback_call[2]
