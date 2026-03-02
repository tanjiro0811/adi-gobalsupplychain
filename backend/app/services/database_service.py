from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    and_,
    create_engine,
    desc,
    func,
    select,
)
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.config import get_settings


class DatabaseError(RuntimeError):
    """Raised when a database operation fails."""


class DatabaseConflictError(DatabaseError):
    """Raised for database uniqueness/conflict violations."""


metadata = MetaData()

users_table = Table(
    "users",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String(120), nullable=False),
    Column("email", String(160), nullable=False, unique=True),
    Column("password_hash", String(255), nullable=False),
    Column("role", String(40), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

guest_entries_table = Table(
    "guest_entries",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("name", String(120), nullable=False),
    Column("email", String(160), nullable=False),
    Column("company", String(160), nullable=False),
    Column("phone", String(64), nullable=False),
    Column("role", String(40), nullable=False),
    Column("source", String(64), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

products_table = Table(
    "products",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("sku", String(80), nullable=False, unique=True),
    Column("name", String(200), nullable=False),
    Column("quantity", Integer, nullable=False, default=0),
    Column("price", Float, nullable=False, default=0.0),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

batches_table = Table(
    "batches",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("batch_id", String(80), nullable=False, unique=True),
    Column("product_sku", String(80), nullable=False),
    Column("quantity", Integer, nullable=False),
    Column("ledger_hash", String(128), nullable=False),
    Column("tx_hash", String(128), nullable=False),
    Column("status", String(40), nullable=False),
    Column("order_code", String(80), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

orders_table = Table(
    "orders",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("order_code", String(80), nullable=False, unique=True),
    Column("retailer_name", String(160), nullable=False),
    Column("retailer_email", String(160), nullable=False),
    Column("dealer_id", String(80), nullable=False),
    Column("manufacturer_id", String(80), nullable=True),
    Column("transporter_id", String(80), nullable=True),
    Column("product_sku", String(80), nullable=False),
    Column("quantity", Integer, nullable=False),
    Column("status", String(80), nullable=False),
    Column("current_stage", String(80), nullable=False),
    Column("batch_id", String(80), nullable=True),
    Column("shipment_id", String(80), nullable=True),
    Column("origin", String(160), nullable=True),
    Column("destination", String(160), nullable=True),
    Column("dealer_received_at", DateTime(timezone=True), nullable=True),
    Column("retail_received_at", DateTime(timezone=True), nullable=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

shipments_table = Table(
    "shipments",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("shipment_id", String(80), nullable=False, unique=True),
    Column("order_code", String(80), nullable=True),
    Column("lat", Float, nullable=True),
    Column("lng", Float, nullable=True),
    Column("status", String(80), nullable=False),
    Column("origin", String(160), nullable=True),
    Column("destination", String(160), nullable=True),
    Column("eta", String(80), nullable=True),
    Column("weight", Float, nullable=True),
    Column("vehicle_number", String(80), nullable=True),
    Column("assignment_status", String(80), nullable=True),
    Column("timestamp", DateTime(timezone=True), nullable=False),
)

shipment_events_table = Table(
    "shipment_events",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("order_code", String(80), nullable=False),
    Column("product_sku", String(80), nullable=False),
    Column("shipment_id", String(80), nullable=True),
    Column("event_stage", String(80), nullable=False),
    Column("event_status", String(80), nullable=False),
    Column("lat", Float, nullable=True),
    Column("lng", Float, nullable=True),
    Column("distance_km", Float, nullable=True),
    Column("eta_hours", Float, nullable=True),
    Column("tx_hash", String(128), nullable=False),
    Column("payload", JSON, nullable=False, default={}),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

ledger_records_table = Table(
    "ledger_records",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("record_key", String(180), nullable=False, unique=True),
    Column("product_id", String(80), nullable=False),
    Column("batch_id", String(80), nullable=False),
    Column("event_stage", String(80), nullable=False),
    Column("payload", JSON, nullable=False, default={}),
    Column("ledger_hash", String(128), nullable=False),
    Column("tx_hash", String(128), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)

sales_history_table = Table(
    "sales_history",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("sku", String(80), nullable=False),
    Column("units_sold", Integer, nullable=False),
    Column("sale_amount", Float, nullable=False),
    Column("retailer_name", String(160), nullable=False),
    Column("sold_at", DateTime(timezone=True), nullable=False),
)

notifications_table = Table(
    "notifications",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", String(120), nullable=False),
    Column("title", String(160), nullable=False),
    Column("message", Text, nullable=False),
    Column("severity", String(24), nullable=False),
    Column("metadata", JSON, nullable=False, default={}),
    Column("created_at", DateTime(timezone=True), nullable=False),
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _db_path() -> Path:
    settings = get_settings()
    configured = Path(settings.sqlite_db_path).expanduser()
    if configured.is_absolute():
        return configured
    backend_root = Path(__file__).resolve().parents[2]
    return (backend_root / configured).resolve()


def _normalize_database_url() -> str:
    settings = get_settings()
    raw = str(settings.database_url or "").strip()
    if raw:
        if raw.startswith("postgres://"):
            return raw.replace("postgres://", "postgresql+psycopg2://", 1)
        if raw.startswith("postgresql://") and "+" not in raw.split("://", 1)[0]:
            return raw.replace("postgresql://", "postgresql+psycopg2://", 1)
        return raw

    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{path.as_posix()}"


@lru_cache
def _engine() -> Engine:
    try:
        return create_engine(
            _normalize_database_url(),
            future=True,
            pool_pre_ping=True,
        )
    except SQLAlchemyError as exc:
        raise DatabaseError("Unable to initialize database engine") from exc


def _row_to_dict(row: Any) -> dict:
    if row is None:
        return {}
    data = dict(row._mapping)
    for key in ("payload", "metadata"):
        value = data.get(key)
        if isinstance(value, str):
            try:
                data[key] = json.loads(value)
            except json.JSONDecodeError:
                data[key] = {}
    return data


def _stage_title(stage: str) -> str:
    return str(stage or "").replace("_", " ").title()


def _next_order_code(conn) -> str:
    max_id = conn.execute(select(func.max(orders_table.c.id))).scalar() or 0
    return f"ORD-{int(max_id) + 1:05d}"


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return round(radius * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))), 2)


def _seed_defaults() -> None:
    now = _utc_now()
    with _engine().begin() as conn:
        user_count = conn.execute(select(func.count()).select_from(users_table)).scalar() or 0
        if user_count == 0:
            conn.execute(
                users_table.insert(),
                [
                    {
                        "name": "System Admin",
                        "email": "admin@globalsupply.com",
                        "password_hash": "admin123",
                        "role": "admin",
                        "created_at": now,
                    },
                    {
                        "name": "Manufacturer",
                        "email": "manufacturer@globalsupply.com",
                        "password_hash": "maker123",
                        "role": "manufacturer",
                        "created_at": now,
                    },
                    {
                        "name": "Transporter",
                        "email": "transporter@globalsupply.com",
                        "password_hash": "transport123",
                        "role": "transporter",
                        "created_at": now,
                    },
                    {
                        "name": "Dealer",
                        "email": "dealer@globalsupply.com",
                        "password_hash": "dealer123",
                        "role": "dealer",
                        "created_at": now,
                    },
                    {
                        "name": "Retail",
                        "email": "retail@globalsupply.com",
                        "password_hash": "retail123",
                        "role": "retail_shop",
                        "created_at": now,
                    },
                ],
            )

        product_count = conn.execute(select(func.count()).select_from(products_table)).scalar() or 0
        if product_count == 0:
            conn.execute(
                products_table.insert(),
                [
                    {
                        "sku": "N95-KIT",
                        "name": "N95 Safety Kit",
                        "quantity": 1200,
                        "price": 42.5,
                        "created_at": now,
                    },
                    {
                        "sku": "IV-SET",
                        "name": "IV Set",
                        "quantity": 760,
                        "price": 15.0,
                        "created_at": now,
                    },
                ],
            )

        shipment_count = conn.execute(select(func.count()).select_from(shipments_table)).scalar() or 0
        if shipment_count == 0:
            conn.execute(
                shipments_table.insert(),
                [
                    {
                        "shipment_id": "SHP-1001",
                        "order_code": "ORD-00001",
                        "lat": 18.5204,
                        "lng": 73.8567,
                        "status": "in_transit",
                        "origin": "Mumbai, MH",
                        "destination": "Bengaluru, KA",
                        "eta": "2026-03-03T14:30:00Z",
                        "weight": 1260.0,
                        "vehicle_number": "MH12AB4321",
                        "assignment_status": "Assigned",
                        "timestamp": now,
                    },
                    {
                        "shipment_id": "SHP-1002",
                        "order_code": "ORD-00002",
                        "lat": 28.6139,
                        "lng": 77.2090,
                        "status": "delayed",
                        "origin": "Delhi, DL",
                        "destination": "Jaipur, RJ",
                        "eta": "2026-03-03T16:15:00Z",
                        "weight": 980.0,
                        "vehicle_number": "DL05CD7788",
                        "assignment_status": "Assigned",
                        "timestamp": now,
                    },
                ],
            )

        order_count = conn.execute(select(func.count()).select_from(orders_table)).scalar() or 0
        if order_count == 0:
            conn.execute(
                orders_table.insert(),
                [
                    {
                        "order_code": "ORD-00001",
                        "retailer_name": "Nova Med",
                        "retailer_email": "buyer@novamed.example",
                        "dealer_id": "dealer",
                        "manufacturer_id": "manufacturer",
                        "transporter_id": "transporter",
                        "product_sku": "N95-KIT",
                        "quantity": 180,
                        "status": "in_transit",
                        "current_stage": "in_transit",
                        "batch_id": None,
                        "shipment_id": "SHP-1001",
                        "origin": "Mumbai, MH",
                        "destination": "Bengaluru, KA",
                        "created_at": now,
                        "updated_at": now,
                    },
                    {
                        "order_code": "ORD-00002",
                        "retailer_name": "CareHub",
                        "retailer_email": "purchase@carehub.example",
                        "dealer_id": "dealer",
                        "manufacturer_id": "manufacturer",
                        "transporter_id": "transporter",
                        "product_sku": "IV-SET",
                        "quantity": 140,
                        "status": "transporter_assigned",
                        "current_stage": "transporter_assigned",
                        "batch_id": None,
                        "shipment_id": "SHP-1002",
                        "origin": "Delhi, DL",
                        "destination": "Jaipur, RJ",
                        "created_at": now,
                        "updated_at": now,
                    },
                ],
            )

        sales_count = conn.execute(select(func.count()).select_from(sales_history_table)).scalar() or 0
        if sales_count == 0:
            sales_rows: list[dict] = []
            for offset in range(1, 31):
                sold_at = now - timedelta(days=offset)
                sales_rows.append(
                    {
                        "sku": "N95-KIT",
                        "units_sold": 24 + (offset % 5),
                        "sale_amount": float((24 + (offset % 5)) * 42.5),
                        "retailer_name": "Nova Med",
                        "sold_at": sold_at,
                    }
                )
                sales_rows.append(
                    {
                        "sku": "IV-SET",
                        "units_sold": 18 + (offset % 6),
                        "sale_amount": float((18 + (offset % 6)) * 15.0),
                        "retailer_name": "CareHub",
                        "sold_at": sold_at,
                    }
                )
            conn.execute(sales_history_table.insert(), sales_rows)


def initialize_database() -> None:
    try:
        metadata.create_all(_engine())
        _seed_defaults()
    except SQLAlchemyError as exc:
        raise DatabaseError("Database initialization failed") from exc


def check_database_connection() -> dict:
    try:
        with _engine().connect() as conn:
            conn.execute(select(1)).scalar()
            db_url = _normalize_database_url()
            return {"ok": True, "path": str(_db_path()) if db_url.startswith("sqlite") else db_url}
    except SQLAlchemyError as exc:
        raise DatabaseError("Database connectivity check failed") from exc


def get_user_by_email(email: str) -> dict | None:
    try:
        with _engine().connect() as conn:
            row = conn.execute(
                select(users_table).where(users_table.c.email == str(email).strip().lower())
            ).first()
            return _row_to_dict(row) if row else None
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to query user by email") from exc


def create_user(name: str, email: str, password_hash: str, role: str) -> dict:
    created_at = _utc_now()
    try:
        with _engine().begin() as conn:
            result = conn.execute(
                users_table.insert().values(
                    name=name,
                    email=str(email).strip().lower(),
                    password_hash=password_hash,
                    role=role,
                    created_at=created_at,
                )
            )
            user_id = int(result.inserted_primary_key[0])
    except IntegrityError as exc:
        raise DatabaseConflictError("User email already exists") from exc
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to create user") from exc

    return {
        "id": user_id,
        "name": name,
        "email": str(email).strip().lower(),
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
    created_at = _utc_now()
    try:
        with _engine().begin() as conn:
            result = conn.execute(
                guest_entries_table.insert().values(
                    name=name,
                    email=str(email).strip().lower(),
                    company=company,
                    phone=phone,
                    role=role,
                    source=source,
                    created_at=created_at,
                )
            )
            entry_id = int(result.inserted_primary_key[0])
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to store guest entry") from exc

    return {
        "id": entry_id,
        "name": name,
        "email": str(email).strip().lower(),
        "company": company,
        "phone": phone,
        "role": role,
        "source": source,
        "created_at": created_at,
    }


def count_users() -> int:
    try:
        with _engine().connect() as conn:
            return int(conn.execute(select(func.count()).select_from(users_table)).scalar() or 0)
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to count users") from exc


def count_guest_entries() -> int:
    try:
        with _engine().connect() as conn:
            return int(conn.execute(select(func.count()).select_from(guest_entries_table)).scalar() or 0)
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to count guest entries") from exc


def list_users() -> list[dict]:
    try:
        with _engine().connect() as conn:
            rows = conn.execute(select(users_table).order_by(users_table.c.id.asc())).fetchall()
            return [_row_to_dict(row) for row in rows]
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to list users") from exc


def list_products() -> list[dict]:
    try:
        with _engine().connect() as conn:
            rows = conn.execute(select(products_table).order_by(products_table.c.id.asc())).fetchall()
            return [_row_to_dict(row) for row in rows]
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to list products") from exc


def get_product_by_sku(sku: str) -> dict | None:
    try:
        with _engine().connect() as conn:
            row = conn.execute(select(products_table).where(products_table.c.sku == sku)).first()
            return _row_to_dict(row) if row else None
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to fetch product") from exc


def create_product(*, sku: str, name: str, quantity: int, price: float) -> dict:
    created_at = _utc_now()
    try:
        with _engine().begin() as conn:
            result = conn.execute(
                products_table.insert().values(
                    sku=sku.strip().upper(),
                    name=name.strip(),
                    quantity=int(quantity),
                    price=float(price),
                    created_at=created_at,
                )
            )
            product_id = int(result.inserted_primary_key[0])
    except IntegrityError as exc:
        raise DatabaseConflictError("SKU already exists") from exc
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to create product") from exc

    return {
        "id": product_id,
        "sku": sku.strip().upper(),
        "name": name.strip(),
        "quantity": int(quantity),
        "price": float(price),
        "created_at": created_at,
    }


def increment_product_stock(sku: str, quantity: int) -> dict:
    try:
        with _engine().begin() as conn:
            conn.execute(
                products_table.update()
                .where(products_table.c.sku == sku)
                .values(quantity=products_table.c.quantity + int(quantity))
            )
            row = conn.execute(select(products_table).where(products_table.c.sku == sku)).first()
            if row is None:
                raise DatabaseError("Product SKU not found")
            return _row_to_dict(row)
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to update product stock") from exc


def decrement_product_stock(sku: str, quantity: int) -> dict:
    requested = int(quantity)
    if requested <= 0:
        raise DatabaseConflictError("Quantity must be greater than 0")
    try:
        with _engine().begin() as conn:
            row = conn.execute(select(products_table).where(products_table.c.sku == sku)).first()
            if row is None:
                raise DatabaseError("Product SKU not found")
            product = _row_to_dict(row)
            current_qty = int(product.get("quantity") or 0)
            if current_qty < requested:
                raise DatabaseConflictError("Insufficient stock")
            conn.execute(
                products_table.update()
                .where(products_table.c.sku == sku)
                .values(quantity=current_qty - requested)
            )
            updated = conn.execute(select(products_table).where(products_table.c.sku == sku)).first()
            return _row_to_dict(updated)
    except DatabaseConflictError:
        raise
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to update product stock") from exc


def list_batches() -> list[dict]:
    try:
        with _engine().connect() as conn:
            rows = conn.execute(select(batches_table).order_by(desc(batches_table.c.id))).fetchall()
            return [_row_to_dict(row) for row in rows]
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to list batches") from exc


def create_batch(
    *,
    batch_id: str,
    product_sku: str,
    quantity: int,
    ledger_hash: str,
    tx_hash: str,
    status: str = "created",
    order_code: str | None = None,
) -> dict:
    created_at = _utc_now()
    try:
        with _engine().begin() as conn:
            conn.execute(
                batches_table.insert().values(
                    batch_id=batch_id,
                    product_sku=product_sku,
                    quantity=int(quantity),
                    ledger_hash=ledger_hash,
                    tx_hash=tx_hash,
                    status=status,
                    order_code=order_code,
                    created_at=created_at,
                )
            )
            conn.execute(
                products_table.update()
                .where(products_table.c.sku == product_sku)
                .values(quantity=products_table.c.quantity + int(quantity))
            )
            row = conn.execute(select(batches_table).where(batches_table.c.batch_id == batch_id)).first()
            return _row_to_dict(row)
    except IntegrityError as exc:
        raise DatabaseConflictError("Batch ID already exists") from exc
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to create batch") from exc


def get_batch(batch_id: str) -> dict | None:
    try:
        with _engine().connect() as conn:
            row = conn.execute(select(batches_table).where(batches_table.c.batch_id == batch_id)).first()
            return _row_to_dict(row) if row else None
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to fetch batch") from exc


def create_order(
    *,
    retailer_name: str,
    retailer_email: str,
    dealer_id: str,
    product_sku: str,
    quantity: int,
    origin: str | None = None,
    destination: str | None = None,
) -> dict:
    now = _utc_now()
    try:
        with _engine().begin() as conn:
            order_code = _next_order_code(conn)
            conn.execute(
                orders_table.insert().values(
                    order_code=order_code,
                    retailer_name=retailer_name,
                    retailer_email=retailer_email,
                    dealer_id=dealer_id,
                    product_sku=product_sku,
                    quantity=int(quantity),
                    status="retail_ordered",
                    current_stage="retail_ordered",
                    origin=origin,
                    destination=destination,
                    created_at=now,
                    updated_at=now,
                )
            )
            row = conn.execute(select(orders_table).where(orders_table.c.order_code == order_code)).first()
            return _row_to_dict(row)
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to create order") from exc


def update_order_stage(
    order_code: str,
    *,
    stage: str,
    status: str | None = None,
    manufacturer_id: str | None = None,
    transporter_id: str | None = None,
    batch_id: str | None = None,
    shipment_id: str | None = None,
    dealer_received: bool = False,
    retail_received: bool = False,
) -> dict | None:
    values: dict[str, Any] = {
        "current_stage": stage,
        "status": status or stage,
        "updated_at": _utc_now(),
    }
    if manufacturer_id is not None:
        values["manufacturer_id"] = manufacturer_id
    if transporter_id is not None:
        values["transporter_id"] = transporter_id
    if batch_id is not None:
        values["batch_id"] = batch_id
    if shipment_id is not None:
        values["shipment_id"] = shipment_id
    if dealer_received:
        values["dealer_received_at"] = _utc_now()
    if retail_received:
        values["retail_received_at"] = _utc_now()

    try:
        with _engine().begin() as conn:
            conn.execute(
                orders_table.update().where(orders_table.c.order_code == order_code).values(**values)
            )
            row = conn.execute(select(orders_table).where(orders_table.c.order_code == order_code)).first()
            return _row_to_dict(row) if row else None
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to update order stage") from exc


def get_order(order_code: str) -> dict | None:
    try:
        with _engine().connect() as conn:
            row = conn.execute(select(orders_table).where(orders_table.c.order_code == order_code)).first()
            return _row_to_dict(row) if row else None
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to fetch order") from exc


def list_orders(limit: int = 100) -> list[dict]:
    try:
        with _engine().connect() as conn:
            rows = conn.execute(
                select(orders_table).order_by(desc(orders_table.c.updated_at)).limit(int(limit))
            ).fetchall()
            return [_row_to_dict(row) for row in rows]
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to list orders") from exc


def create_or_update_shipment(
    *,
    shipment_id: str,
    order_code: str | None,
    lat: float | None,
    lng: float | None,
    status: str,
    origin: str | None = None,
    destination: str | None = None,
    eta: str | None = None,
    weight: float | None = None,
    vehicle_number: str | None = None,
    assignment_status: str | None = None,
) -> dict:
    now = _utc_now()
    try:
        with _engine().begin() as conn:
            exists = conn.execute(
                select(shipments_table.c.id).where(shipments_table.c.shipment_id == shipment_id)
            ).first()
            payload = {
                "order_code": order_code,
                "lat": lat,
                "lng": lng,
                "status": status,
                "origin": origin,
                "destination": destination,
                "eta": eta,
                "weight": weight,
                "vehicle_number": vehicle_number,
                "assignment_status": assignment_status or "Assigned",
                "timestamp": now,
            }
            if exists:
                conn.execute(
                    shipments_table.update()
                    .where(shipments_table.c.shipment_id == shipment_id)
                    .values(**payload)
                )
            else:
                conn.execute(shipments_table.insert().values(shipment_id=shipment_id, **payload))
            row = conn.execute(
                select(shipments_table).where(shipments_table.c.shipment_id == shipment_id)
            ).first()
            return _row_to_dict(row)
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to upsert shipment") from exc


def update_shipment_location(*, shipment_id: str, lat: float, lng: float, status: str) -> dict | None:
    try:
        with _engine().begin() as conn:
            conn.execute(
                shipments_table.update()
                .where(shipments_table.c.shipment_id == shipment_id)
                .values(lat=lat, lng=lng, status=status, timestamp=_utc_now())
            )
            row = conn.execute(
                select(shipments_table).where(shipments_table.c.shipment_id == shipment_id)
            ).first()
            return _row_to_dict(row) if row else None
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to update shipment location") from exc


def list_shipments() -> dict[str, dict]:
    try:
        with _engine().connect() as conn:
            rows = conn.execute(select(shipments_table).order_by(shipments_table.c.id.asc())).fetchall()
            mapped: dict[str, dict] = {}
            for row in rows:
                item = _row_to_dict(row)
                mapped[item["shipment_id"]] = {
                    "lat": item.get("lat"),
                    "lng": item.get("lng"),
                    "status": item.get("status"),
                    "origin": item.get("origin"),
                    "destination": item.get("destination"),
                    "eta": item.get("eta"),
                    "weight": item.get("weight"),
                    "vehicleNumber": item.get("vehicle_number"),
                    "assignmentStatus": item.get("assignment_status") or "Assigned",
                    "timestamp": (
                        item.get("timestamp").isoformat()
                        if isinstance(item.get("timestamp"), datetime)
                        else str(item.get("timestamp") or "")
                    ),
                }
            return mapped
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to list shipments") from exc


def list_dealer_arrivals(dealer_lat: float = 12.9716, dealer_lng: float = 77.5946) -> list[dict]:
    try:
        with _engine().connect() as conn:
            join_stmt = (
                select(
                    shipments_table.c.shipment_id,
                    shipments_table.c.status,
                    shipments_table.c.origin,
                    shipments_table.c.destination,
                    shipments_table.c.eta,
                    shipments_table.c.lat,
                    shipments_table.c.lng,
                    shipments_table.c.weight,
                    shipments_table.c.vehicle_number,
                    orders_table.c.order_code,
                    orders_table.c.product_sku,
                    orders_table.c.quantity,
                    orders_table.c.current_stage,
                )
                .select_from(
                    shipments_table.outerjoin(
                        orders_table,
                        shipments_table.c.order_code == orders_table.c.order_code,
                    )
                )
                .order_by(desc(shipments_table.c.timestamp))
            )
            rows = conn.execute(join_stmt).fetchall()

        arrivals: list[dict] = []
        for index, row in enumerate(rows, start=1):
            record = dict(row._mapping)
            lat = record.get("lat")
            lng = record.get("lng")
            distance_km = None
            eta_hours = None
            if lat is not None and lng is not None:
                distance_km = _haversine_km(float(lat), float(lng), float(dealer_lat), float(dealer_lng))
                eta_hours = round(distance_km / 45.0, 1)

            status = str(record.get("status") or "in_transit")
            stage = str(record.get("current_stage") or status)
            arrivals.append(
                {
                    "id": index,
                    "shipmentId": record.get("shipment_id"),
                    "orderId": record.get("order_code"),
                    "manufacturer": "Global Supply Manufacturer",
                    "carrier": "Prime Logistics",
                    "origin": record.get("origin") or "Unknown",
                    "destination": record.get("destination") or "Unknown",
                    "status": stage.replace("_", " ").title(),
                    "estimatedArrival": record.get("eta") or "",
                    "currentLocation": (
                        f"{round(float(lat), 4)}, {round(float(lng), 4)}"
                        if lat is not None and lng is not None
                        else "Location unavailable"
                    ),
                    "progress": 95 if "deliver" in status else 35 if "delay" in status else 70,
                    "blockchainVerified": True,
                    "items": int(record.get("quantity") or 0),
                    "distanceKm": distance_km,
                    "etaHours": eta_hours,
                    "dealerMessage": (
                        f"Your shipment is {distance_km} km away, ETA {eta_hours} hours"
                        if distance_km is not None and eta_hours is not None
                        else "Waiting for live GPS signal"
                    ),
                    "lat": lat,
                    "lng": lng,
                    "vehicleNumber": record.get("vehicle_number") or "--",
                    "productSku": record.get("product_sku") or "--",
                }
            )
        return arrivals
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to list dealer arrivals") from exc


def create_ledger_record(
    *,
    product_id: str,
    batch_id: str,
    event_stage: str,
    payload: dict,
    ledger_hash: str,
    tx_hash: str,
) -> dict:
    created_at = _utc_now()
    record_key = f"{product_id}:{batch_id}:{event_stage}:{tx_hash[:16]}"
    try:
        with _engine().begin() as conn:
            exists = conn.execute(
                select(ledger_records_table.c.id).where(ledger_records_table.c.record_key == record_key)
            ).first()
            values = {
                "record_key": record_key,
                "product_id": product_id,
                "batch_id": batch_id,
                "event_stage": event_stage,
                "payload": payload,
                "ledger_hash": ledger_hash,
                "tx_hash": tx_hash,
                "created_at": created_at,
            }
            if exists:
                conn.execute(
                    ledger_records_table.update()
                    .where(ledger_records_table.c.record_key == record_key)
                    .values(**values)
                )
            else:
                conn.execute(ledger_records_table.insert().values(**values))
            row = conn.execute(
                select(ledger_records_table).where(ledger_records_table.c.record_key == record_key)
            ).first()
            return _row_to_dict(row)
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to write ledger record") from exc


def get_ledger_record(product_id: str, batch_id: str, event_stage: str | None = None) -> dict | None:
    try:
        with _engine().connect() as conn:
            stmt = select(ledger_records_table).where(
                and_(
                    ledger_records_table.c.product_id == product_id,
                    ledger_records_table.c.batch_id == batch_id,
                )
            )
            if event_stage:
                stmt = stmt.where(ledger_records_table.c.event_stage == event_stage)
            row = conn.execute(stmt.order_by(desc(ledger_records_table.c.created_at))).first()
            return _row_to_dict(row) if row else None
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to fetch ledger record") from exc


def get_ledger_record_by_tx_hash(tx_hash: str) -> dict | None:
    try:
        with _engine().connect() as conn:
            row = conn.execute(
                select(ledger_records_table).where(ledger_records_table.c.tx_hash == tx_hash)
            ).first()
            return _row_to_dict(row) if row else None
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to query tx hash") from exc


def list_ledger_records(limit: int = 100) -> list[dict]:
    try:
        with _engine().connect() as conn:
            rows = conn.execute(
                select(ledger_records_table).order_by(desc(ledger_records_table.c.created_at)).limit(limit)
            ).fetchall()
            return [_row_to_dict(row) for row in rows]
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to list ledger records") from exc


def record_shipment_event(
    *,
    order_code: str,
    product_sku: str,
    shipment_id: str | None,
    event_stage: str,
    event_status: str,
    tx_hash: str,
    payload: dict,
    lat: float | None = None,
    lng: float | None = None,
    distance_km: float | None = None,
    eta_hours: float | None = None,
) -> dict:
    created_at = _utc_now()
    try:
        with _engine().begin() as conn:
            result = conn.execute(
                shipment_events_table.insert().values(
                    order_code=order_code,
                    product_sku=product_sku,
                    shipment_id=shipment_id,
                    event_stage=event_stage,
                    event_status=event_status,
                    lat=lat,
                    lng=lng,
                    distance_km=distance_km,
                    eta_hours=eta_hours,
                    tx_hash=tx_hash,
                    payload=payload,
                    created_at=created_at,
                )
            )
            event_id = int(result.inserted_primary_key[0])
            row = conn.execute(
                select(shipment_events_table).where(shipment_events_table.c.id == event_id)
            ).first()
            return _row_to_dict(row)
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to record shipment event") from exc


def get_product_journey(product_sku: str) -> list[dict]:
    try:
        with _engine().connect() as conn:
            rows = conn.execute(
                select(shipment_events_table)
                .where(shipment_events_table.c.product_sku == product_sku)
                .order_by(shipment_events_table.c.created_at.asc())
            ).fetchall()

        journey: list[dict] = []
        for row in rows:
            item = _row_to_dict(row)
            created_at = item.get("created_at")
            journey.append(
                {
                    "eventStage": item.get("event_stage"),
                    "eventStatus": item.get("event_status"),
                    "orderCode": item.get("order_code"),
                    "shipmentId": item.get("shipment_id"),
                    "txHash": item.get("tx_hash"),
                    "distanceKm": item.get("distance_km"),
                    "etaHours": item.get("eta_hours"),
                    "location": (
                        {"lat": item.get("lat"), "lng": item.get("lng")}
                        if item.get("lat") is not None and item.get("lng") is not None
                        else None
                    ),
                    "payload": item.get("payload") or {},
                    "timestamp": created_at.isoformat() if isinstance(created_at, datetime) else str(created_at),
                }
            )
        return journey
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to load product journey") from exc


def record_sale(*, sku: str, units_sold: int, sale_amount: float, retailer_name: str, sold_at: datetime | None = None) -> dict:
    timestamp = sold_at or _utc_now()
    try:
        with _engine().begin() as conn:
            result = conn.execute(
                sales_history_table.insert().values(
                    sku=sku,
                    units_sold=int(units_sold),
                    sale_amount=float(sale_amount),
                    retailer_name=retailer_name,
                    sold_at=timestamp,
                )
            )
            sale_id = int(result.inserted_primary_key[0])
            row = conn.execute(select(sales_history_table).where(sales_history_table.c.id == sale_id)).first()
            return _row_to_dict(row)
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to record sale") from exc


def get_sales_history(days: int = 30) -> list[dict]:
    since = _utc_now() - timedelta(days=max(days, 1))
    try:
        with _engine().connect() as conn:
            rows = conn.execute(
                select(sales_history_table)
                .where(sales_history_table.c.sold_at >= since)
                .order_by(sales_history_table.c.sold_at.asc())
            ).fetchall()
            return [_row_to_dict(row) for row in rows]
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to query sales history") from exc


def get_sales_analytics(period: str = "week") -> dict:
    normalized = str(period).lower()
    days = 30 if normalized == "month" else 7
    since = _utc_now() - timedelta(days=days)
    try:
        with _engine().connect() as conn:
            sales_rows = conn.execute(
                select(sales_history_table)
                .where(sales_history_table.c.sold_at >= since)
                .order_by(sales_history_table.c.sold_at.asc())
            ).fetchall()
            products = conn.execute(select(products_table)).fetchall()
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to build sales analytics") from exc

    totals_by_day: dict[str, float] = {}
    units_by_sku: dict[str, int] = {}
    revenue_by_sku: dict[str, float] = {}
    for row in sales_rows:
        item = _row_to_dict(row)
        sold_at = item.get("sold_at")
        day_label = (
            sold_at.strftime("%a") if normalized != "month" else f"D{int(sold_at.strftime('%d'))}"
            if isinstance(sold_at, datetime)
            else "D1"
        )
        totals_by_day[day_label] = totals_by_day.get(day_label, 0.0) + float(item.get("sale_amount") or 0.0)
        sku = str(item.get("sku") or "")
        units_by_sku[sku] = units_by_sku.get(sku, 0) + int(item.get("units_sold") or 0)
        revenue_by_sku[sku] = revenue_by_sku.get(sku, 0.0) + float(item.get("sale_amount") or 0.0)

    trend: list[dict] = []
    if normalized == "month":
        for day in range(1, 31):
            label = f"D{day}"
            trend.append({"label": label, "value": round(totals_by_day.get(label, 0.0), 2)})
    else:
        for label in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]:
            trend.append({"label": label, "value": round(totals_by_day.get(label, 0.0), 2)})

    product_names = {item["sku"]: item["name"] for item in [_row_to_dict(row) for row in products]}
    top_products = [
        {
            "product": product_names.get(sku, sku),
            "units": units,
            "revenue": f"${revenue_by_sku.get(sku, 0.0):,.2f}",
            "growth": "+5%" if units > 0 else "0%",
        }
        for sku, units in sorted(units_by_sku.items(), key=lambda kv: kv[1], reverse=True)
    ][:5]

    recent_transactions = []
    for row in sorted([_row_to_dict(r) for r in sales_rows], key=lambda item: item.get("sold_at"), reverse=True)[:8]:
        sold_at = row.get("sold_at")
        recent_transactions.append(
            {
                "id": f"TXN-{row.get('id')}",
                "time": sold_at.strftime("%H:%M") if isinstance(sold_at, datetime) else "--:--",
                "items": int(row.get("units_sold") or 0),
                "amount": f"${float(row.get('sale_amount') or 0.0):,.2f}",
                "payment": "Card",
                "status": "Completed",
            }
        )

    today_value = trend[-1]["value"] if trend else 0.0
    week_value = sum(item["value"] for item in trend[-7:]) if trend else 0.0
    month_value = sum(item["value"] for item in trend) if trend else 0.0
    avg_tx = month_value / max(len(recent_transactions), 1)

    return {
        "period": "month" if normalized == "month" else "week",
        "trend": trend,
        "topProducts": top_products,
        "recentTransactions": recent_transactions,
        "salesStats": {
            "today": f"${today_value:,.0f}",
            "week": f"${week_value:,.0f}",
            "month": f"${month_value:,.0f}",
            "avgTransaction": f"${avg_tx:,.2f}",
        },
    }


def reorder_recommendations(days: int = 30) -> list[dict]:
    since = _utc_now() - timedelta(days=max(days, 1))
    try:
        with _engine().connect() as conn:
            product_rows = conn.execute(select(products_table)).fetchall()
            sales_rows = conn.execute(
                select(sales_history_table)
                .where(sales_history_table.c.sold_at >= since)
                .order_by(sales_history_table.c.sold_at.asc())
            ).fetchall()
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to generate reorder recommendations") from exc

    sold_by_sku: dict[str, int] = {}
    for row in sales_rows:
        item = _row_to_dict(row)
        sku = str(item.get("sku") or "")
        sold_by_sku[sku] = sold_by_sku.get(sku, 0) + int(item.get("units_sold") or 0)

    recommendations: list[dict] = []
    for row in product_rows:
        product = _row_to_dict(row)
        sku = str(product.get("sku") or "")
        current_stock = int(product.get("quantity") or 0)
        total_sold = sold_by_sku.get(sku, 0)
        avg_daily_sales = round(total_sold / max(days, 1), 2)
        stockout_days = round(current_stock / avg_daily_sales, 1) if avg_daily_sales > 0 else None
        should_reorder = stockout_days is not None and stockout_days <= 5
        recommendations.append(
            {
                "sku": sku,
                "productName": product.get("name"),
                "currentStock": current_stock,
                "avgDailySales": avg_daily_sales,
                "stockOutDays": stockout_days,
                "recommendation": (
                    f"Reorder now - stock runs out in {stockout_days} days."
                    if should_reorder
                    else "Stock level is healthy."
                ),
                "priority": "high" if should_reorder else "normal",
            }
        )
    return recommendations


def create_notification(
    *,
    user_id: str,
    title: str,
    message: str,
    severity: str = "info",
    metadata_payload: dict | None = None,
) -> dict:
    created_at = _utc_now()
    payload = metadata_payload or {}
    try:
        with _engine().begin() as conn:
            result = conn.execute(
                notifications_table.insert().values(
                    user_id=user_id,
                    title=title,
                    message=message,
                    severity=severity,
                    metadata=payload,
                    created_at=created_at,
                )
            )
            notification_id = int(result.inserted_primary_key[0])
            row = conn.execute(
                select(notifications_table).where(notifications_table.c.id == notification_id)
            ).first()
            return _row_to_dict(row)
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to create notification") from exc


def list_notifications(user_id: str | None = None, limit: int = 50) -> list[dict]:
    try:
        with _engine().connect() as conn:
            stmt = select(notifications_table)
            if user_id:
                stmt = stmt.where(notifications_table.c.user_id == user_id)
            rows = conn.execute(stmt.order_by(desc(notifications_table.c.created_at)).limit(limit)).fetchall()
            return [_row_to_dict(row) for row in rows]
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to list notifications") from exc


def summarize_global_metrics() -> dict:
    try:
        with _engine().connect() as conn:
            return {
                "total_products": int(conn.execute(select(func.count()).select_from(products_table)).scalar() or 0),
                "total_batches": int(conn.execute(select(func.count()).select_from(batches_table)).scalar() or 0),
                "active_shipments": int(conn.execute(select(func.count()).select_from(shipments_table)).scalar() or 0),
                "revenue": round(
                    float(
                        conn.execute(
                            select(func.coalesce(func.sum(sales_history_table.c.sale_amount), 0.0))
                        ).scalar()
                        or 0.0
                    ),
                    2,
                ),
            }
    except SQLAlchemyError as exc:
        raise DatabaseError("Failed to summarize global metrics") from exc


def build_admin_blockchain_transactions() -> dict:
    records = list_ledger_records(limit=500)
    transactions = [
        {
            "id": idx,
            "transactionHash": item.get("tx_hash"),
            "productBatch": item.get("batch_id"),
            "manufacturer": "Global Supply Manufacturer",
            "status": "verified",
            "blockNumber": 18234000 + idx,
            "gasFee": 38 + (idx % 10),
            "timestamp": (
                item.get("created_at").isoformat()
                if isinstance(item.get("created_at"), datetime)
                else str(item.get("created_at") or "")
            ),
            "productDetails": {
                "productId": item.get("product_id"),
                "eventStage": item.get("event_stage"),
                "payload": item.get("payload") or {},
            },
        }
        for idx, item in enumerate(records, start=1)
    ]
    total = len(transactions)
    return {
        "transactions": transactions,
        "stats": {
            "totalVerifications": total,
            "successRate": 100.0 if total else 0.0,
            "avgGasFee": round(sum(float(item["gasFee"]) for item in transactions) / max(total, 1), 2),
            "pendingTransactions": 0,
        },
    }


def append_pipeline_event(
    *,
    order_code: str,
    product_sku: str,
    stage: str,
    tx_hash: str,
    payload: dict,
    shipment_id: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    distance_km: float | None = None,
    eta_hours: float | None = None,
) -> dict:
    return record_shipment_event(
        order_code=order_code,
        product_sku=product_sku,
        shipment_id=shipment_id,
        event_stage=stage,
        event_status=_stage_title(stage),
        tx_hash=tx_hash,
        payload=payload,
        lat=lat,
        lng=lng,
        distance_km=distance_km,
        eta_hours=eta_hours,
    )
