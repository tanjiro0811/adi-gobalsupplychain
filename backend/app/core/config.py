from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_env: str
    cors_origins: tuple[str, ...]
    cors_origin_regex: str
    secret_key: str
    jwt_algorithm: str
    access_token_expire_minutes: int
    mysql_url: str
    database_url: str
    sqlite_db_path: str
    blockchain_salt: str
    ai_provider: str
    anthropic_api_key: str
    anthropic_model: str
    gemini_api_key: str
    gemini_model: str
    smtp_server: str
    smtp_port: int
    sender_email: str
    sender_password: str
    sender_name: str
    mock_email_delivery: bool


class ConfigurationError(RuntimeError):
    """Raised when required environment configuration is invalid."""


_ENV_LOADED = False
_ENV_FILE_KEYS: set[str] = set()


def _load_env_file(path: Path, *, override_file_keys: bool = False) -> None:
    if not path.exists() or not path.is_file():
        return

    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return

    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue

        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]

        # Keep explicit shell env vars higher priority than .env files, but allow a later
        # .env file (backend/.env) to override values that came from an earlier .env file.
        if key not in os.environ:
            os.environ[key] = value
            _ENV_FILE_KEYS.add(key)
            continue

        if override_file_keys and key in _ENV_FILE_KEYS:
            os.environ[key] = value
            _ENV_FILE_KEYS.add(key)


def _load_env_files_once() -> None:
    global _ENV_LOADED
    if _ENV_LOADED:
        return

    backend_root = Path(__file__).resolve().parents[2]
    project_root = backend_root.parent

    # Load root .env first, then backend/.env to allow backend-specific overrides.
    # Explicit shell env vars remain highest priority.
    _load_env_file(project_root / ".env", override_file_keys=False)
    _load_env_file(backend_root / ".env", override_file_keys=True)
    _ENV_LOADED = True


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

    if not settings.database_url.strip() and not settings.sqlite_db_path.strip():
        errors.append("Either DATABASE_URL or SQLITE_DB_PATH must be set")

    if settings.access_token_expire_minutes <= 0:
        errors.append("ACCESS_TOKEN_EXPIRE_MINUTES must be greater than 0")

    if settings.smtp_port <= 0 or settings.smtp_port > 65535:
        errors.append("SMTP_PORT must be between 1 and 65535")

    if env in {"prod", "production"} and settings.secret_key == "change-me-in-env":
        errors.append("SECRET_KEY must be set in production")

    if env in {"prod", "production"} and ("*" in settings.cors_origins):
        errors.append("CORS origins must not include '*' in production")

    if errors:
        raise ConfigurationError("; ".join(errors))


@lru_cache
def get_settings() -> Settings:
    _load_env_files_once()
    app_env = os.getenv("APP_ENV", "development")
    mock_env = os.getenv("MOCK_EMAIL_DELIVERY")
    # Default to real email unless MOCK_EMAIL_DELIVERY is explicitly enabled.
    default_mock_email = "false" if mock_env is None else mock_env

    cors_raw = (os.getenv("ALLOWED_ORIGINS") or os.getenv("CORS_ORIGINS") or "").strip()
    cors_origins = tuple(origin.strip() for origin in cors_raw.split(",") if origin.strip())
    cors_origin_regex = (os.getenv("ALLOWED_ORIGIN_REGEX") or os.getenv("CORS_ORIGIN_REGEX") or "").strip()
    if not cors_origins:
        cors_origins = ("http://localhost:5173", "http://127.0.0.1:5173")

    is_production = app_env.strip().lower() in {"prod", "production"}
    render_external_url = (os.getenv("RENDER_EXTERNAL_URL") or "").strip()
    if not is_production:
        local_dev_origins = (
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
        )
        merged_origins: list[str] = []
        for origin in (*cors_origins, *local_dev_origins):
            if origin and origin not in merged_origins:
                merged_origins.append(origin)
        cors_origins = tuple(merged_origins)
        if render_external_url and not cors_origin_regex:
            # Render preview/static-site hostnames vary, so allow Render-hosted frontends
            # during non-production deployments unless an explicit regex is provided.
            cors_origin_regex = r"https://.*\.onrender\.com"

    return Settings(
        app_name=os.getenv("APP_NAME", "Global Supply Chain API"),
        app_env=app_env,
        cors_origins=cors_origins,
        cors_origin_regex=cors_origin_regex,
        secret_key=os.getenv("SECRET_KEY", "change-me-in-env"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        access_token_expire_minutes=_to_int("ACCESS_TOKEN_EXPIRE_MINUTES", "60"),
        mysql_url=os.getenv(
            "MYSQL_URL",
            "mysql+pymysql://root:password@localhost:3306/global_supply_chain",
        ),
        database_url=os.getenv("DATABASE_URL", "").strip(),
        sqlite_db_path=os.getenv("SQLITE_DB_PATH", "local.db"),
        blockchain_salt=os.getenv("BLOCKCHAIN_SALT", "global-supply-chain-salt"),
        ai_provider=os.getenv("AI_PROVIDER", "auto").strip().lower(),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", "").strip(),
        anthropic_model=os.getenv("ANTHROPIC_MODEL", "claude-opus-4-6").strip(),
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip(),
        smtp_server=os.getenv("SMTP_SERVER", "smtp.gmail.com"),
        smtp_port=_to_int("SMTP_PORT", "587"),
        sender_email=os.getenv("SENDER_EMAIL", "noreply@globalsupplychain.local"),
        # Gmail App Passwords are often copied with spaces (e.g. "xxxx xxxx xxxx xxxx").
        # Strip whitespace so users can paste directly into .env.
        sender_password=os.getenv("SENDER_PASSWORD", "").replace(" ", ""),
        sender_name=os.getenv("SENDER_NAME", "Global Supply Chain"),
        mock_email_delivery=_to_bool(os.getenv("MOCK_EMAIL_DELIVERY", default_mock_email)),
    )
