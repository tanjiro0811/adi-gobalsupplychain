from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_env: str
    secret_key: str
    jwt_algorithm: str
    access_token_expire_minutes: int
    mysql_url: str
    sqlite_db_path: str
    blockchain_salt: str
    smtp_server: str
    smtp_port: int
    sender_email: str
    sender_password: str
    sender_name: str
    mock_email_delivery: bool


class ConfigurationError(RuntimeError):
    """Raised when required environment configuration is invalid."""


def _to_bool(value: str) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _to_int(name: str, default: str) -> int:
    raw = os.getenv(name, default)
    try:
        return int(raw)
    except (TypeError, ValueError) as exc:
        raise ConfigurationError(f"Environment variable {name} must be an integer") from exc


def validate_settings(settings: Settings) -> None:
    errors: list[str] = []
    env = settings.app_env.strip().lower()

    if not settings.sqlite_db_path.strip():
        errors.append("SQLITE_DB_PATH cannot be empty")

    if settings.access_token_expire_minutes <= 0:
        errors.append("ACCESS_TOKEN_EXPIRE_MINUTES must be greater than 0")

    if settings.smtp_port <= 0 or settings.smtp_port > 65535:
        errors.append("SMTP_PORT must be between 1 and 65535")

    if env in {"prod", "production"} and settings.secret_key == "change-me-in-env":
        errors.append("SECRET_KEY must be set in production")

    if errors:
        raise ConfigurationError("; ".join(errors))


@lru_cache
def get_settings() -> Settings:
    app_env = os.getenv("APP_ENV", "development")
    default_mock_email = "true" if app_env.lower() == "development" else "false"

    return Settings(
        app_name=os.getenv("APP_NAME", "Global Supply Chain API"),
        app_env=app_env,
        secret_key=os.getenv("SECRET_KEY", "change-me-in-env"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        access_token_expire_minutes=_to_int("ACCESS_TOKEN_EXPIRE_MINUTES", "60"),
        mysql_url=os.getenv(
            "MYSQL_URL",
            "mysql+pymysql://root:password@localhost:3306/global_supply_chain",
        ),
        sqlite_db_path=os.getenv("SQLITE_DB_PATH", "data/app.db"),
        blockchain_salt=os.getenv("BLOCKCHAIN_SALT", "global-supply-chain-salt"),
        smtp_server=os.getenv("SMTP_SERVER", "smtp.gmail.com"),
        smtp_port=_to_int("SMTP_PORT", "587"),
        sender_email=os.getenv("SENDER_EMAIL", "noreply@globalsupplychain.local"),
        sender_password=os.getenv("SENDER_PASSWORD", ""),
        sender_name=os.getenv("SENDER_NAME", "Global Supply Chain"),
        mock_email_delivery=_to_bool(os.getenv("MOCK_EMAIL_DELIVERY", default_mock_email)),
    )
