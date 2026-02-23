from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.middleware import require_roles
from app.models.user import UserRole
from app.services.state_service import products, shipments

router = APIRouter(prefix="/dealer", tags=["dealer"])


def _inventory_items() -> list[dict]:
    items: list[dict] = []
    for index, product in enumerate(products, start=1):
        quantity = int(product.get("quantity", 0))
        min_stock = max(25, int(quantity * 0.3))
        max_stock = max(quantity, min_stock + 100)
        if quantity <= max(10, int(min_stock * 0.4)):
            stock_status = "Out of Stock" if quantity == 0 else "Low Stock"
        elif quantity <= min_stock:
            stock_status = "Low Stock"
        else:
            stock_status = "In Stock"

        category = (
            "Medicines"
            if "IV" in str(product.get("sku", ""))
            else "Surgical Supplies"
            if "KIT" in str(product.get("sku", ""))
            else "Medical Devices"
        )

        items.append(
            {
                "id": index,
                "sku": product.get("sku", f"SKU-{index:03d}"),
                "productName": product.get("name", f"Product {index}"),
                "category": category,
                "manufacturer": "Global Supply Manufacturer",
                "currentStock": quantity,
                "minStock": min_stock,
                "maxStock": max_stock,
                "unitPrice": float(product.get("price", 0.0)),
                "stockStatus": stock_status,
                "lastRestocked": "2026-02-10",
            }
        )
    return items


def _arrivals() -> list[dict]:
    mapped: list[dict] = []
    for index, (shipment_id, data) in enumerate(shipments.items(), start=1):
        status = str(data.get("status", "in_transit"))
        if "delay" in status:
            ui_status = "Delayed"
            progress = 40
        elif "transit" in status:
            ui_status = "In Transit"
            progress = 70
        else:
            ui_status = "Arriving Today"
            progress = 95

        mapped.append(
            {
                "id": index,
                "shipmentId": shipment_id,
                "orderId": f"DL-{3300 + index}",
                "manufacturer": "Global Supply Manufacturer",
                "carrier": "Prime Logistics",
                "origin": "Mumbai, MH",
                "destination": "Bengaluru, KA",
                "status": ui_status,
                "estimatedArrival": "2026-02-18",
                "currentLocation": f"{data.get('lat')}, {data.get('lng')}",
                "progress": progress,
                "blockchainVerified": True,
                "items": 50 + index * 10,
            }
        )
    return mapped


@router.get(
    "/orders/recent",
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))],
)
def recent_orders() -> dict:
    return {
        "orders": [
            {
                "orderId": "DL-3321",
                "retailer": "Nova Med",
                "amount": "$2,460",
                "status": "Dispatched",
                "date": "2026-02-15",
            },
            {
                "orderId": "DL-3322",
                "retailer": "CareHub",
                "amount": "$1,810",
                "status": "Pending",
                "date": "2026-02-14",
            },
            {
                "orderId": "DL-3323",
                "retailer": "Prime Labs",
                "amount": "$4,105",
                "status": "Delivered",
                "date": "2026-02-13",
            },
        ]
    }


@router.get(
    "/orders/trends",
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))],
)
def order_trends() -> dict:
    return {"trends": [42, 38, 45, 52, 49, 58, 63]}


@router.get(
    "/low-stock",
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))],
)
def low_stock_alerts() -> dict:
    items = [item for item in _inventory_items() if item["stockStatus"] != "In Stock"]
    return {"items": items}


@router.get(
    "/inventory",
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))],
)
def inventory() -> dict:
    return {"items": _inventory_items()}


@router.get(
    "/arrivals",
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))],
)
def arrivals() -> dict:
    return {"shipments": _arrivals()}


@router.get(
    "/analytics",
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))],
)
def analytics(time_range: str = Query("30d", alias="range")) -> dict:
    points = 7 if time_range == "7d" else 90 if time_range == "90d" else 30
    revenue = [1200 + (index % 5) * 140 + (index // 5) * 20 for index in range(points)]
    return {
        "revenue": revenue,
        "topProducts": [
            {"label": "Medicines", "value": 42, "color": "#3b82f6"},
            {"label": "Surgical Supplies", "value": 28, "color": "#10b981"},
            {"label": "Lab Equipment", "value": 18, "color": "#f59e0b"},
            {"label": "Medical Devices", "value": 12, "color": "#8b5cf6"},
        ],
        "orderStatus": [
            {"label": "Delivered", "value": 45, "color": "#22c55e"},
            {"label": "Dispatched", "value": 30, "color": "#0ea5e9"},
            {"label": "Pending", "value": 13, "color": "#f59e0b"},
        ],
        "categoryMix": [
            {"label": "Medicines", "value": 42, "color": "#3b82f6"},
            {"label": "Surgical", "value": 28, "color": "#10b981"},
            {"label": "Equipment", "value": 18, "color": "#f59e0b"},
            {"label": "Devices", "value": 12, "color": "#8b5cf6"},
        ],
    }
