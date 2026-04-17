from types import SimpleNamespace

from app.services import database_service


def test_normalize_database_url_adds_render_sslmode(monkeypatch) -> None:
    settings = SimpleNamespace(
        database_url="postgresql://user:pass@dpg-example.oregon-postgres.render.com/dbname",
        sqlite_db_path="local.db",
    )
    monkeypatch.setattr(database_service, "get_settings", lambda: settings)

    normalized = database_service._normalize_database_url()
    assert normalized.startswith("postgresql+psycopg://")
    assert "sslmode=require" in normalized


def test_normalize_database_url_keeps_existing_sslmode(monkeypatch) -> None:
    settings = SimpleNamespace(
        database_url=(
            "postgresql://user:pass@dpg-example.oregon-postgres.render.com/dbname?sslmode=verify-full"
        ),
        sqlite_db_path="local.db",
    )
    monkeypatch.setattr(database_service, "get_settings", lambda: settings)

    normalized = database_service._normalize_database_url()
    assert "sslmode=verify-full" in normalized
    assert "sslmode=require" not in normalized


def test_normalize_database_url_does_not_force_ssl_for_non_render(monkeypatch) -> None:
    settings = SimpleNamespace(
        database_url="postgresql://user:pass@localhost:5432/dbname",
        sqlite_db_path="local.db",
    )
    monkeypatch.setattr(database_service, "get_settings", lambda: settings)

    normalized = database_service._normalize_database_url()
    assert "sslmode=" not in normalized
