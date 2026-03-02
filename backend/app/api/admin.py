from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.core.middleware import require_roles
from app.models.user import UserRole
from app.services.ai_service import predict_demand
from app.services.database_service import (
    DatabaseError,
    build_admin_blockchain_transactions,
    count_guest_entries,
    count_users,
    get_ledger_record_by_tx_hash,
    get_sales_history,
    list_orders,
    list_users,
    summarize_global_metrics,
)
from app.services.notification_service import notification_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", dependencies=[Depends(require_roles(UserRole.admin))])
def get_global_stats() -> dict:
    try:
        metrics = summarize_global_metrics()
        return {
            "total_users": count_users(),
            "guest_entries": count_guest_entries(),
            "total_products": metrics["total_products"],
            "total_batches": metrics["total_batches"],
            "active_shipments": metrics["active_shipments"],
            "revenue": metrics["revenue"],
        }
    except DatabaseError:
        return {
            "total_users": 0,
            "guest_entries": 0,
            "total_products": 0,
            "total_batches": 0,
            "active_shipments": 0,
            "revenue": 0.0,
        }


@router.get("/ai-forecast", dependencies=[Depends(require_roles(UserRole.admin))])
def get_ai_forecast(
    history: str = Query(""),
    horizon: int = Query(3, ge=1, le=12),
) -> dict:
    values = [float(value.strip()) for value in history.split(",") if value.strip()]
    if not values:
        sales = get_sales_history(days=90)
        values = [float(item.get("units_sold", 0)) for item in sales[-30:]]
    if not values:
        values = [120, 128, 134, 140, 155, 162]
    return {
        "input": values,
        "horizon": horizon,
        "forecast": predict_demand(values, horizon=horizon),
    }


@router.get("/notifications", dependencies=[Depends(require_roles(UserRole.admin))])
def get_notifications(limit: int = Query(20, ge=1, le=100), user_id: Optional[str] = None) -> dict:
    return {"items": notification_service.list_recent(limit=limit, user_id=user_id)}


@router.get("/analytics", dependencies=[Depends(require_roles(UserRole.admin))])
def analytics(time_range: str = Query("30d", alias="range")) -> dict:
    points = 7 if time_range == "7d" else 365 if time_range == "1y" else 90 if time_range == "90d" else 30

    metrics = summarize_global_metrics()
    orders = list_orders(limit=800)
    users = list_users()
    delayed_count = sum(1 for item in orders if "delay" in str(item.get("status", "")).lower())
    in_transit_count = sum(1 for item in orders if "transit" in str(item.get("status", "")).lower())

    base = max(metrics["revenue"] * 0.08, 1200.0)
    throughput = (metrics["active_shipments"] * 180.0) + (metrics["total_batches"] * 140.0)
    delay_penalty = delayed_count * 45.0
    revenue = []
    for idx in range(points):
        cycle = ((idx % 6) - 2.5) * max(throughput * 0.03, 14.0)
        growth = (idx + 1) * max(throughput / max(points, 1), 8.0)
        value = max(0.0, base + growth + cycle - delay_penalty)
        revenue.append(round(value, 2))

    forecast_horizon = 30 if points >= 90 else 14 if points >= 30 else 7
    forecast_source = [float(value) for value in revenue[-min(len(revenue), 12):]]
    forecast = predict_demand(forecast_source, horizon=forecast_horizon)

    role_counts = {
        "Manufacturers": sum(1 for item in users if item.get("role") == UserRole.manufacturer.value),
        "Transporters": sum(1 for item in users if item.get("role") == UserRole.transporter.value),
        "Dealers": sum(1 for item in users if item.get("role") == UserRole.dealer.value),
        "Retail Shops": sum(1 for item in users if item.get("role") == UserRole.retail_shop.value),
    }
    total_users = len(users)
    guest_entries = count_guest_entries()

    active_entities = max(total_users - delayed_count, 0)
    pending_items = max((metrics["active_shipments"] - in_transit_count) + max(guest_entries // 2, 0), 0)
    issue_items = max(delayed_count, 0)
    maintenance_items = max(metrics["active_shipments"] - in_transit_count - delayed_count, 0)

    return {
        "revenue": revenue,
        "forecast": forecast,
        "userDistribution": [
            {"label": "Manufacturers", "value": role_counts["Manufacturers"], "color": "#3b82f6"},
            {"label": "Transporters", "value": role_counts["Transporters"], "color": "#10b981"},
            {"label": "Dealers", "value": role_counts["Dealers"], "color": "#8b5cf6"},
            {"label": "Retail Shops", "value": role_counts["Retail Shops"], "color": "#f59e0b"},
        ],
        "systemStatus": [
            {"label": "Active", "value": active_entities, "color": "#10b981"},
            {"label": "Pending", "value": pending_items, "color": "#f59e0b"},
            {"label": "Issues", "value": issue_items, "color": "#ef4444"},
            {"label": "Maintenance", "value": maintenance_items, "color": "#6b7280"},
        ],
        "apiMetrics": {
            "auth": max(total_users * 12 + guest_entries * 3, 1),
            "blockchain": max(len(build_admin_blockchain_transactions().get("transactions", [])), 1),
            "gps": max(metrics["active_shipments"] * 18, 1),
            "analytics": max(points * 4, 1),
        },
    }


@router.get("/blockchain/transactions", dependencies=[Depends(require_roles(UserRole.admin))])
def blockchain_transactions() -> dict:
    return build_admin_blockchain_transactions()


@router.post("/blockchain/verify", dependencies=[Depends(require_roles(UserRole.admin))])
def verify_blockchain_transaction(payload: dict) -> dict:
    tx_hash = str(payload.get("txHash", "")).strip()
    if not tx_hash:
        return {"success": False, "txHash": "", "message": "txHash required"}
    return {
        "success": get_ledger_record_by_tx_hash(tx_hash) is not None,
        "txHash": tx_hash,
    }


@router.post("/reports/generate", dependencies=[Depends(require_roles(UserRole.admin))])
def generate_report(payload: dict) -> Response:
    report_type = str(payload.get("type", "revenue")).strip() or "revenue"
    start_date = str(payload.get("startDate", "2026-01-01"))
    end_date = str(payload.get("endDate", "2026-01-31"))
    report_format = str(payload.get("format", "pdf")).strip().lower()

    metrics = summarize_global_metrics()
    total_users = count_users()
    total_orders = len(list_orders(limit=1000))
    if report_format == "csv":
        stream = io.StringIO()
        writer = csv.writer(stream)
        writer.writerow(["metric", "value"])
        writer.writerow(["report_type", report_type])
        writer.writerow(["start_date", start_date])
        writer.writerow(["end_date", end_date])
        writer.writerow(["total_users", total_users])
        writer.writerow(["total_orders", total_orders])
        writer.writerow(["total_products", metrics["total_products"]])
        writer.writerow(["total_batches", metrics["total_batches"]])
        writer.writerow(["active_shipments", metrics["active_shipments"]])
        writer.writerow(["revenue", metrics["revenue"]])
        content = stream.getvalue().encode("utf-8")
        media_type = "text/csv"
        suffix = "csv"
    else:
        lines = [
            "Global Supply Chain Report",
            f"type: {report_type}",
            f"period: {start_date} to {end_date}",
            f"total_users: {total_users}",
            f"total_orders: {total_orders}",
            f"total_products: {metrics['total_products']}",
            f"total_batches: {metrics['total_batches']}",
            f"active_shipments: {metrics['active_shipments']}",
            f"revenue: {metrics['revenue']}",
            f"generated_at_utc: {datetime.now(timezone.utc).isoformat()}",
        ]
        content = "\n".join(lines).encode("utf-8")
        media_type = "text/plain"
        suffix = "txt" if report_format == "pdf" else report_format

    filename = f"{report_type}_report_{start_date}_to_{end_date}.{suffix}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
