from __future__ import annotations

import random
import string
from datetime import datetime, timedelta, timezone

# In-memory storage. Replace with Redis in production.
otp_storage: dict[str, dict] = {}
verified_email_storage: dict[str, datetime] = {}


class OTPService:
    """Service for OTP generation and verification."""

    OTP_LENGTH = 6
    OTP_VALIDITY_MINUTES = 10
    VERIFIED_VALIDITY_MINUTES = 15
    MAX_ATTEMPTS = 3

    @classmethod
    def _normalize_email(cls, email: str) -> str:
        return str(email).strip().lower()

    @classmethod
    def generate_otp(cls) -> str:
        return "".join(random.choices(string.digits, k=cls.OTP_LENGTH))

    @classmethod
    def create_otp(cls, email: str) -> str:
        normalized_email = cls._normalize_email(email)
        now = datetime.now(timezone.utc)
        otp = cls.generate_otp()

        otp_storage[normalized_email] = {
            "otp": otp,
            "expiry": now + timedelta(minutes=cls.OTP_VALIDITY_MINUTES),
            "attempts": 0,
            "created_at": now,
        }

        # New OTP invalidates any previous verification for this email.
        verified_email_storage.pop(normalized_email, None)
        return otp

    @classmethod
    def verify_otp(cls, email: str, otp: str) -> tuple[bool, str]:
        normalized_email = cls._normalize_email(email)
        stored_data = otp_storage.get(normalized_email)

        if not stored_data:
            return False, "No OTP found for this email"

        now = datetime.now(timezone.utc)

        if now > stored_data["expiry"]:
            otp_storage.pop(normalized_email, None)
            return False, "OTP has expired"

        if stored_data["attempts"] >= cls.MAX_ATTEMPTS:
            otp_storage.pop(normalized_email, None)
            return False, "Maximum verification attempts exceeded"

        stored_data["attempts"] += 1

        if stored_data["otp"] == otp:
            otp_storage.pop(normalized_email, None)
            verified_email_storage[normalized_email] = now + timedelta(
                minutes=cls.VERIFIED_VALIDITY_MINUTES
            )
            return True, "OTP verified successfully"

        remaining = cls.MAX_ATTEMPTS - stored_data["attempts"]
        if remaining <= 0:
            otp_storage.pop(normalized_email, None)
            return False, "Maximum verification attempts exceeded"

        return False, f"Invalid OTP. {remaining} attempts remaining"

    @classmethod
    def is_otp_valid(cls, email: str) -> bool:
        normalized_email = cls._normalize_email(email)
        stored_data = otp_storage.get(normalized_email)
        if not stored_data:
            return False

        if datetime.now(timezone.utc) > stored_data["expiry"]:
            otp_storage.pop(normalized_email, None)
            return False

        return True

    @classmethod
    def clear_otp(cls, email: str) -> None:
        otp_storage.pop(cls._normalize_email(email), None)

    @classmethod
    def is_email_verified(cls, email: str) -> bool:
        normalized_email = cls._normalize_email(email)
        verified_until = verified_email_storage.get(normalized_email)
        if not verified_until:
            return False

        if datetime.now(timezone.utc) > verified_until:
            verified_email_storage.pop(normalized_email, None)
            return False

        return True

    @classmethod
    def consume_verified_email(cls, email: str) -> bool:
        normalized_email = cls._normalize_email(email)
        if not cls.is_email_verified(normalized_email):
            return False

        verified_email_storage.pop(normalized_email, None)
        return True
