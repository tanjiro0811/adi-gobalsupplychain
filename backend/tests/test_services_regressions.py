from __future__ import annotations

from contextlib import nullcontext
from types import SimpleNamespace

from sqlalchemy.exc import SQLAlchemyError

from app.services import ai_service, database_service


def test_ai_status_prefers_gemini_when_auto_and_only_gemini_key(monkeypatch) -> None:
    settings = SimpleNamespace(
        ai_provider="auto",
        anthropic_api_key="",
        anthropic_model="claude-opus-4-6",
        gemini_api_key="AIza-test-key",
        gemini_model="gemini-2.0-flash",
    )
    monkeypatch.setattr(ai_service, "get_settings", lambda: settings)
    monkeypatch.setattr(ai_service, "anthropic", None)

    status = ai_service.ai_status()

    assert status == {"enabled": True, "provider": "gemini", "model": "gemini-2.0-flash"}


def test_predict_low_stock_uses_explicit_api_key_override(monkeypatch) -> None:
    captured: dict = {}

    def fake_call_json(system: str, user: str, **kwargs):
        captured["system"] = system
        captured["user"] = user
        captured["kwargs"] = kwargs
        return {
            "recommendations": [
                {"sku": "SKU-1", "priority": "high", "recommendation": "Reorder now."},
            ]
        }

    monkeypatch.setattr(ai_service, "ai_configured", lambda: False)
    monkeypatch.setattr(ai_service, "_call_json", fake_call_json)

    result = ai_service.predict_low_stock([{"sku": "SKU-1", "priority": "medium"}], api_key="sk-ant-test-key")

    assert result[0]["priority"] == "high"
    assert result[0]["recommendation"] == "Reorder now."
    assert captured["kwargs"]["provider_override"] == "anthropic"
    assert captured["kwargs"]["anthropic_api_key"] == "sk-ant-test-key"
    assert captured["kwargs"]["gemini_api_key"] is None


def test_engine_falls_back_to_sqlite_and_caches_result(monkeypatch) -> None:
    database_service.reset_engine_for_tests()
    calls: list[str] = []

    class FakeEngine:
        def __init__(self, url: str) -> None:
            self.url = url

        def connect(self):
            return nullcontext()

        def dispose(self) -> None:
            return None

    fallback_engine = FakeEngine("sqlite:///fallback.db")

    def fake_create_engine(url: str, **kwargs):
        calls.append(url)
        if url == "postgresql+psycopg://primary":
            raise SQLAlchemyError("primary unavailable")
        return fallback_engine

    monkeypatch.setattr(
        database_service,
        "_normalize_database_url",
        lambda prefer_sqlite=False: "sqlite:///fallback.db" if prefer_sqlite else "postgresql+psycopg://primary",
    )
    monkeypatch.setattr(database_service, "create_engine", fake_create_engine)

    engine_one = database_service._engine()
    engine_two = database_service._engine()

    assert engine_one is fallback_engine
    assert engine_two is fallback_engine
    assert calls == ["postgresql+psycopg://primary", "sqlite:///fallback.db"]
    assert database_service._current_database_url() == "sqlite:///fallback.db"

    database_service.reset_engine_for_tests()
