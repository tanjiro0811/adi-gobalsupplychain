from __future__ import annotations

from passlib.context import CryptContext  # type: ignore[import-untyped]

pwd_context = CryptContext(
    # Prefer PBKDF2 to avoid bcrypt's 72-byte password limit and Windows bcrypt backend quirks.
    # Keep bcrypt available for verifying any existing bcrypt hashes.
    schemes=["pbkdf2_sha256", "bcrypt"],
    deprecated="auto",
    pbkdf2_sha256__default_rounds=120000,
)


def is_password_hash(value: str | None) -> bool:
    # Passlib hashes always begin with "$" (e.g. "$2b$..." or "$pbkdf2-sha256$...").
    return str(value or "").startswith("$")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, stored_password_hash: str) -> bool:
    try:
        return pwd_context.verify(plain_password, stored_password_hash)
    except Exception:
        return False
