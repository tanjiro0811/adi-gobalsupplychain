from __future__ import annotations

from app.core import config


def _load_settings(monkeypatch, **env: str) -> config.Settings:
    config.get_settings.cache_clear()
    monkeypatch.setattr(config, "_load_env_files_once", lambda: None)

    keys = [
        "APP_ENV",
        "ALLOWED_ORIGINS",
        "CORS_ORIGINS",
        "ALLOWED_ORIGIN_REGEX",
        "CORS_ORIGIN_REGEX",
        "RENDER_EXTERNAL_URL",
    ]
    for key in keys:
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)

    settings = config.get_settings()
    config.get_settings.cache_clear()
    return settings


def test_get_settings_uses_render_origin_regex_for_non_production(monkeypatch) -> None:
    settings = _load_settings(
        monkeypatch,
        APP_ENV="development",
        RENDER_EXTERNAL_URL="https://globalsupplychainmanagementsystem-wras.onrender.com",
    )

    assert settings.cors_origin_regex == r"https://.*\.onrender\.com"
    assert "http://localhost:5173" in settings.cors_origins


def test_get_settings_does_not_infer_render_origin_regex_in_production(monkeypatch) -> None:
    settings = _load_settings(
        monkeypatch,
        APP_ENV="production",
        RENDER_EXTERNAL_URL="https://globalsupplychainmanagementsystem-wras.onrender.com",
    )

    assert settings.cors_origin_regex == ""
