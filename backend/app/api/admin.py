from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.core.middleware import require_roles
from app.models.user import UserRole
from app.services.ai_service import predict_demand
from app.services.notification_service import notification_service
from app.services.state_service import batches, ledger_records, products, shipments, users

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", dependencies=[Depends(require_roles(UserRole.admin))])
def get_global_stats() -> dict:
    revenue = sum(item["quantity"] * item["price"] for item in products)
    return {
        "total_users": len(users),
        "total_products": len(products),
        "total_batches": len(batches),
        "active_shipments": len(shipments),
        "revenue": round(revenue, 2),
    }


@router.get("/ai-forecast", dependencies=[Depends(require_roles(UserRole.admin))])
def get_ai_forecast(
    history: str = Query("120,128,134,140,155,162"),
    horizon: int = Query(3, ge=1, le=12),
) -> dict:
    values = [float(value.strip()) for value in history.split(",") if value.strip()]
    return {
        "input": values,
        "horizon": horizon,
        "forecast": predict_demand(values, horizon=horizon),
    }


@router.get("/notifications", dependencies=[Depends(require_roles(UserRole.admin))])
def get_notifications(limit: int = Query(20, ge=1, le=100)) -> dict:
    return {"items": notification_service.list_recent(limit=limit)}


@router.get("/analytics", dependencies=[Depends(require_roles(UserRole.admin))])
def analytics(time_range: str = Query("30d", alias="range")) -> dict:
    points = 7 if time_range == "7d" else 365 if time_range == "1y" else 90 if time_range == "90d" else 30
    revenue = [50000 + (idx % 6) * 6500 + (idx // 6) * 1200 for idx in range(points)]
    forecast = predict_demand([float(value) for value in revenue[-6:]], horizon=60)
    normalized_roles = [
        role.value if hasattr(role, "value") else str(role) for role in [u.get("role") for u in users.values()]
    ]
    role_counts = {
        "Manufacturers": len([role for role in normalized_roles if role == UserRole.manufacturer.value]),
        "Transporters": len([role for role in normalized_roles if role == UserRole.transporter.value]),
        "Dealers": len([role for role in normalized_roles if role == UserRole.dealer.value]),
        "Retail Shops": len([role for role in normalized_roles if role == UserRole.retail_shop.value]),
    }
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
            {"label": "Active", "value": 892, "color": "#10b981"},
            {"label": "Pending", "value": 45, "color": "#f59e0b"},
            {"label": "Issues", "value": 12, "color": "#ef4444"},
            {"label": "Maintenance", "value": 8, "color": "#6b7280"},
        ],
        "apiMetrics": {
            "auth": 12847,
            "blockchain": 8523,
            "gps": 15234,
            "analytics": 6789,
        },
    }


@router.get("/blockchain/transactions", dependencies=[Depends(require_roles(UserRole.admin))])
def blockchain_transactions() -> dict:
    transactions = []
    if ledger_records:
        for index, (key, record) in enumerate(ledger_records.items(), start=1):
            product_id, batch_id = key.split(":", 1)
            transactions.append(
                {
                    "id": index,
                    "transactionHash": record.get("ledger_hash"),
                    "productBatch": batch_id,
                    "manufacturer": "Global Supply Manufacturer",
                    "status": "verified",
                    "blockNumber": 18234567 + index,
                    "gasFee": 45,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "productDetails": {
                        "productId": product_id,
                        "payload": record.get("payload", {}),
                    },
                }
            )
    else:
        transactions = [
            {
                "id": 1,
                "transactionHash": "0x7f9fade1c0d57a7af66ab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385",
                "productBatch": "BATCH-2024-001",
                "manufacturer": "ABC Manufacturing",
                "status": "verified",
                "blockNumber": 18234567,
                "gasFee": 42,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "productDetails": {"name": "Product A", "quantity": 1000, "category": "Electronics"},
            },
            {
                "id": 2,
                "transactionHash": "0x8c1fade2d1e68b8bg77bc5fbe8efade2d1e68b8bg77bc5fbe8d3d3fc8c22b02496",
                "productBatch": "BATCH-2024-002",
                "manufacturer": "XYZ Industries",
                "status": "pending",
                "blockNumber": None,
                "gasFee": 0,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "productDetails": {"name": "Product B", "quantity": 500, "category": "Automotive"},
            },
        ]
    total = len(transactions)
    verified = len([tx for tx in transactions if tx.get("status") == "verified"])
    pending = len([tx for tx in transactions if tx.get("status") == "pending"])
    avg_gas = round(sum(float(tx.get("gasFee", 0) or 0) for tx in transactions) / max(total, 1), 2)
    return {
        "transactions": transactions,
        "stats": {
            "totalVerifications": total,
            "successRate": round((verified / max(total, 1)) * 100, 2),
            "avgGasFee": avg_gas,
            "pendingTransactions": pending,
        },
    }


@router.post("/blockchain/verify", dependencies=[Depends(require_roles(UserRole.admin))])
def verify_blockchain_transaction(payload: dict) -> dict:
    tx_hash = str(payload.get("txHash", "")).strip()
    return {"success": bool(tx_hash), "txHash": tx_hash}


@router.post("/reports/generate", dependencies=[Depends(require_roles(UserRole.admin))])
def generate_report(payload: dict) -> Response:
    report_type = str(payload.get("type", "revenue")).strip() or "revenue"
    start_date = str(payload.get("startDate", "2026-01-01"))
    end_date = str(payload.get("endDate", "2026-01-31"))
    report_format = str(payload.get("format", "pdf")).strip().lower()

    if report_format == "csv":
        stream = io.StringIO()
        writer = csv.writer(stream)
        writer.writerow(["metric", "value"])
        writer.writerow(["report_type", report_type])
        writer.writerow(["start_date", start_date])
        writer.writerow(["end_date", end_date])
        writer.writerow(["total_users", len(users)])
        writer.writerow(["total_products", len(products)])
        writer.writerow(["total_batches", len(batches)])
        writer.writerow(["active_shipments", len(shipments)])
        content = stream.getvalue().encode("utf-8")
        media_type = "text/csv"
        suffix = "csv"
    else:
        lines = [
            "Global Supply Chain Report",
            f"type: {report_type}",
            f"period: {start_date} to {end_date}",
            f"total_users: {len(users)}",
            f"total_products: {len(products)}",
            f"total_batches: {len(batches)}",
            f"active_shipments: {len(shipments)}",
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
