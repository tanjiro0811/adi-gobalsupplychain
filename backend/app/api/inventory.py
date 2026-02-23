from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.middleware import require_roles
from app.models.user import UserRole
from app.services.state_service import products

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get(
    "",
    dependencies=[
        Depends(
            require_roles(
                UserRole.admin,
                UserRole.retail_shop,
                UserRole.dealer,
                UserRole.manufacturer,
            )
        )
    ],
)
def get_inventory() -> dict:
    product_rows = []
    for index, item in enumerate(products, start=1):
        quantity = int(item.get("quantity", 0))
        reorder_level = max(20, int(quantity * 0.35))
        status = (
            "critical"
            if quantity <= max(8, int(reorder_level * 0.4))
            else "low-stock"
            if quantity <= reorder_level
            else "in-stock"
        )
        product_rows.append(
            {
                "id": item.get("sku", f"SKU-{index:03d}"),
                "name": item.get("name", f"Product {index}"),
                "category": "PPE" if "KIT" in str(item.get("sku", "")) else "Medical Supplies",
                "stock": quantity,
                "reorderLevel": reorder_level,
                "price": float(item.get("price", 0.0)),
                "verified": True,
                "status": status,
            }
        )

    sales_rows = [
        {"label": "Mon", "value": 420},
        {"label": "Tue", "value": 580},
        {"label": "Wed", "value": 490},
        {"label": "Thu", "value": 720},
        {"label": "Fri", "value": 650},
        {"label": "Sat", "value": 890},
        {"label": "Sun", "value": 540},
    ]

    return {"products": product_rows, "sales": sales_rows}


@router.get(
    "/sales-analytics",
    dependencies=[
        Depends(
            require_roles(
                UserRole.admin,
                UserRole.retail_shop,
                UserRole.dealer,
                UserRole.manufacturer,
            )
        )
    ],
)
def get_sales_analytics(time_range: str = Query("week", alias="range")) -> dict:
    period = "month" if str(time_range).lower() == "month" else "week"
    trend = (
        [
            {"label": "Week 1", "value": 3200},
            {"label": "Week 2", "value": 4100},
            {"label": "Week 3", "value": 3800},
            {"label": "Week 4", "value": 4500},
        ]
        if period == "month"
        else [
            {"label": "Mon", "value": 420},
            {"label": "Tue", "value": 580},
            {"label": "Wed", "value": 490},
            {"label": "Thu", "value": 720},
            {"label": "Fri", "value": 650},
            {"label": "Sat", "value": 890},
            {"label": "Sun", "value": 540},
        ]
    )

    top_products = []
    for index, item in enumerate(products, start=1):
        units = max(20, int(item.get("quantity", 0) * 0.07))
        revenue = units * float(item.get("price", 0.0))
        growth = f"+{6 + index * 2}%"
        top_products.append(
            {
                "product": item.get("name", f"Product {index}"),
                "units": units,
                "revenue": f"${revenue:,.2f}",
                "growth": growth,
            }
        )

    if len(top_products) < 5:
        fallback_items = [
            {"product": "N95 Mask Box", "units": 320, "revenue": "$14,716.80", "growth": "+12%"},
            {"product": "Nitrile Gloves", "units": 245, "revenue": "$6,122.55", "growth": "+8%"},
            {"product": "Digital Thermometer", "units": 189, "revenue": "$3,022.11", "growth": "+15%"},
            {"product": "Home Care Kit", "units": 78, "revenue": "$7,019.22", "growth": "+5%"},
            {"product": "IV Set Standard", "units": 156, "revenue": "$1,950.00", "growth": "-3%"},
        ]
        top_products = (top_products + fallback_items)[:5]

    transactions = [
        {"id": "TXN-001", "time": "10:24 AM", "items": 3, "amount": "$124.97", "payment": "Card", "status": "Completed"},
        {"id": "TXN-002", "time": "10:18 AM", "items": 1, "amount": "$45.99", "payment": "Cash", "status": "Completed"},
        {"id": "TXN-003", "time": "10:05 AM", "items": 5, "amount": "$237.45", "payment": "UPI", "status": "Completed"},
        {"id": "TXN-004", "time": "09:52 AM", "items": 2, "amount": "$89.98", "payment": "Wallet", "status": "Completed"},
    ]

    today_total = sum(point["value"] for point in trend[-1:]) if period == "week" else int(trend[-1]["value"] / 7)
    week_total = sum(point["value"] for point in trend) if period == "week" else int(sum(point["value"] for point in trend) / 4)
    month_total = sum(point["value"] for point in trend) if period == "month" else sum(point["value"] for point in trend) * 4
    avg_transaction = sum(item["units"] for item in top_products) / max(len(transactions), 1)

    return {
        "period": period,
        "trend": trend,
        "topProducts": top_products[:5],
        "recentTransactions": transactions,
        "salesStats": {
            "today": f"${today_total:,.0f}",
            "week": f"${week_total:,.0f}",
            "month": f"${month_total:,.0f}",
            "avgTransaction": f"${avg_transaction:,.2f}",
        },
    }
