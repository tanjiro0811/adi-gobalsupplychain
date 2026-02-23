from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import get_settings


class DatabaseError(RuntimeError):
    """Raised when a database operation fails."""


class DatabaseConflictError(DatabaseError):
    """Raised for database uniqueness/conflict violations."""


def _db_path() -> Path:
    settings = get_settings()
    configured = Path(settings.sqlite_db_path).expanduser()
    if configured.is_absolute():
        return configured

    backend_root = Path(__file__).resolve().parents[2]
    return (backend_root / configured).resolve()


def _connect() -> sqlite3.Connection:
    path = _db_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error as exc:
        raise DatabaseError("Unable to connect to SQLite database") from exc


def _column_names(conn: sqlite3.Connection, table_name: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {str(row[1]) for row in rows}


def _ensure_column(
    conn: sqlite3.Connection,
    table_name: str,
    column_name: str,
    ddl_fragment: str,
) -> None:
    columns = _column_names(conn, table_name)
    if column_name in columns:
        return
    conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl_fragment}")


def initialize_database() -> None:
    try:
        with _connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            # Backward-compatible migrations for old local DB files.
            _ensure_column(conn, "users", "name", "TEXT NOT NULL DEFAULT ''")
            _ensure_column(conn, "users", "email", "TEXT NOT NULL DEFAULT ''")
            _ensure_column(conn, "users", "password_hash", "TEXT NOT NULL DEFAULT ''")
            _ensure_column(conn, "users", "role", "TEXT NOT NULL DEFAULT 'dealer'")
            _ensure_column(conn, "users", "created_at", "TEXT NOT NULL DEFAULT ''")

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS guest_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    company TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    role TEXT NOT NULL,
                    source TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            _ensure_column(conn, "guest_entries", "name", "TEXT NOT NULL DEFAULT ''")
            _ensure_column(conn, "guest_entries", "email", "TEXT NOT NULL DEFAULT ''")
            _ensure_column(conn, "guest_entries", "company", "TEXT NOT NULL DEFAULT ''")
            _ensure_column(conn, "guest_entries", "phone", "TEXT NOT NULL DEFAULT ''")
            _ensure_column(conn, "guest_entries", "role", "TEXT NOT NULL DEFAULT 'dealer'")
            _ensure_column(conn, "guest_entries", "source", "TEXT NOT NULL DEFAULT 'guest_form'")
            _ensure_column(conn, "guest_entries", "created_at", "TEXT NOT NULL DEFAULT ''")
    except sqlite3.Error as exc:
        raise DatabaseError("Database initialization failed") from exc


def get_user_by_email(email: str) -> dict | None:
    try:
        with _connect() as conn:
            row = conn.execute(
                """
                SELECT id, name, email, password_hash, role, created_at
                FROM users
                WHERE email = ?
                """,
                (email,),
            ).fetchone()
            if not row:
                return None
            return dict(row)
    except sqlite3.Error as exc:
        raise DatabaseError("Failed to query user by email") from exc


def create_user(name: str, email: str, password_hash: str, role: str) -> dict:
    created_at = datetime.now(timezone.utc).isoformat()
    try:
        with _connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO users (name, email, password_hash, role, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name, email, password_hash, role, created_at),
            )
            user_id = int(cursor.lastrowid)
    except sqlite3.IntegrityError as exc:
        if "users.email" in str(exc):
            raise DatabaseConflictError("User email already exists") from exc
        raise DatabaseError("Failed to create user due to integrity constraint") from exc
    except sqlite3.Error as exc:
        raise DatabaseError("Failed to create user") from exc

    return {
        "id": user_id,
        "name": name,
        "email": email,
        "password_hash": password_hash,
        "role": role,
        "created_at": created_at,
    }


def create_guest_entry(
    *,
    name: str,
    email: str,
    company: str,
    phone: str,
    role: str,
    source: str = "guest_form",
) -> dict:
    created_at = datetime.now(timezone.utc).isoformat()
    try:
        with _connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO guest_entries (name, email, company, phone, role, source, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (name, email, company, phone, role, source, created_at),
            )
            entry_id = int(cursor.lastrowid)
    except sqlite3.Error as exc:
        raise DatabaseError("Failed to store guest entry") from exc

    return {
        "id": entry_id,
        "name": name,
        "email": email,
        "company": company,
        "phone": phone,
        "role": role,
        "source": source,
        "created_at": created_at,
    }


def check_database_connection() -> dict:
    try:
        with _connect() as conn:
            conn.execute("SELECT 1").fetchone()
            return {"ok": True, "path": str(_db_path())}
    except sqlite3.Error as exc:
        raise DatabaseError("Database connectivity check failed") from exc
