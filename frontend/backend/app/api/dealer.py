from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.middleware import require_roles
from app.models.user import UserRole
from app.services.blockchain_service import generate_product_hash, generate_tx_hash
from app.services.database_service import (
    DatabaseError,
    append_pipeline_event,
    create_ledger_record,
    create_order,
    get_order,
    get_product_by_sku,
    format_inr,
    list_dealer_arrivals,
    list_orders,
    list_products,
    reorder_recommendations,
    update_order_stage,
)
from app.services.ai_service import predict_low_stock
from app.core.config import get_settings
from app.services.notification_service import notification_service

router = APIRouter(prefix="/dealer", tags=["dealer"])


class RetailOrderCreateRequest(BaseModel):
    retailer_name: str = Field(min_length=2, max_length=120)
    retailer_email: str = Field(min_length=5, max_length=160)
    product_sku: str
    quantity: int = Field(gt=0)
    origin: str = Field(default="Manufacturer Hub")
    destination: str = Field(default="Dealer Warehouse")


class DealerOrderForwardRequest(BaseModel):
    manufacturer_id: str = Field(default="manufacturer")


def _write_stage_event(order: dict, stage: str, payload: dict) -> str:
    tx_hash = generate_tx_hash(payload)
    ledger_hash = generate_product_hash(
        product_id=str(order.get("product_sku")),
        batch_id=str(order.get("batch_id") or "NA"),
        payload=payload,
    )
    create_ledger_record(
        product_id=str(order.get("product_sku")),
        batch_id=str(order.get("batch_id") or "NA"),
        event_stage=stage,
        payload=payload,
        ledger_hash=ledger_hash,
        tx_hash=tx_hash,
    )
    append_pipeline_event(
        order_code=str(order.get("order_code")),
        product_sku=str(order.get("product_sku")),
        stage=stage,
        tx_hash=tx_hash,
        payload=payload,
        shipment_id=order.get("shipment_id"),
    )
    return tx_hash


def _inventory_items() -> list[dict]:
    items: list[dict] = []
    for index, product in enumerate(list_products(), start=1):
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
                "id": int(product.get("id", index)),
                "sku": product.get("sku", f"SKU-{index:03d}"),
                "productName": product.get("name", f"Product {index}"),
                "category": category,
                "manufacturer": "Global Supply Manufacturer",
                "currentStock": quantity,
                "minStock": min_stock,
                "maxStock": max_stock,
                "unitPrice": float(product.get("price", 0.0)),
                "stockStatus": stock_status,
                "lastRestocked": datetime.now(timezone.utc).date().isoformat(),
            }
        )
    return items


def _pipeline_rows(limit: int = 100) -> list[dict]:
    orders = list_orders(limit=limit)
    rows: list[dict] = []
    for order in orders:
        sku = str(order.get("product_sku"))
        product = get_product_by_sku(sku) or {}
        price = float(product.get("price") or 0.0)
        qty = int(order.get("quantity") or 0)
        created_at = order.get("created_at")
        rows.append(
            {
                "orderCode": order.get("order_code"),
                "retailer": order.get("retailer_name"),
                "retailerEmail": order.get("retailer_email"),
                "productSku": sku,
                "quantity": qty,
                "amount": round(price * qty, 2),
                "currentStage": order.get("current_stage"),
                "status": order.get("status"),
                "shipmentId": order.get("shipment_id"),
                "batchId": order.get("batch_id"),
                "manufacturerId": order.get("manufacturer_id"),
                "transporterId": order.get("transporter_id"),
                "origin": order.get("origin") or "Manufacturer Hub",
                "destination": order.get("destination") or "Dealer Warehouse",
                "createdAt": created_at.isoformat() if isinstance(created_at, datetime) else str(created_at or ""),
            }
        )
    return rows


@router.post("/orders/retail", dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer, UserRole.retail_shop))])
def create_retail_order(data: RetailOrderCreateRequest) -> dict:
    if get_product_by_sku(data.product_sku) is None:
        raise HTTPException(status_code=404, detail="Product SKU not found")

    try:
        order = create_order(
            retailer_name=data.retailer_name,
            retailer_email=data.retailer_email,
            dealer_id="dealer",
            product_sku=data.product_sku,
            quantity=data.quantity,
            origin=data.origin,
            destination=data.destination,
        )
        tx_hash = _write_stage_event(
            order,
            stage="retail_ordered",
            payload={
                "orderCode": order["order_code"],
                "retailer": data.retailer_name,
                "productSku": data.product_sku,
                "quantity": data.quantity,
            },
        )
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc

    notification_service.publish(
        user_id="dealer",
        title="New retail order",
        message=f"{order['order_code']} placed by {data.retailer_name}.",
        metadata={"orderCode": order["order_code"], "txHash": tx_hash},
    )
    return {"order": order, "txHash": tx_hash}


@router.patch("/orders/{order_code}/confirm", dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))])
def confirm_retail_order(order_code: str) -> dict:
    order = get_order(order_code)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        updated = update_order_stage(order_code, stage="dealer_confirmed", status="dealer_confirmed")
        tx_hash = _write_stage_event(
            updated or order,
            stage="dealer_confirmed",
            payload={"orderCode": order_code, "confirmedBy": "dealer"},
        )
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc

    notification_service.publish(
        user_id="retail_shop",
        title="Order confirmed",
        message=f"{order_code} confirmed by dealer.",
        metadata={"orderCode": order_code, "txHash": tx_hash},
    )
    return {"order": updated, "txHash": tx_hash}


@router.patch("/orders/{order_code}/dealer-order", dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))])
def forward_order_to_manufacturer(order_code: str, data: DealerOrderForwardRequest) -> dict:
    order = get_order(order_code)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        updated = update_order_stage(
            order_code,
            stage="dealer_ordered_manufacturer",
            status="dealer_ordered_manufacturer",
            manufacturer_id=data.manufacturer_id,
        )
        tx_hash = _write_stage_event(
            updated or order,
            stage="dealer_ordered_manufacturer",
            payload={"orderCode": order_code, "manufacturerId": data.manufacturer_id},
        )
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc

    notification_service.publish(
        user_id=data.manufacturer_id,
        title="Dealer order queued",
        message=f"{order_code} requires batch creation.",
        metadata={"orderCode": order_code, "txHash": tx_hash},
    )
    return {"order": updated, "txHash": tx_hash}


@router.patch("/orders/{order_code}/receive", dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))])
def receive_order(order_code: str) -> dict:
    order = get_order(order_code)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        updated = update_order_stage(
            order_code,
            stage="dealer_received",
            status="dealer_received",
            dealer_received=True,
        )
        tx_hash = _write_stage_event(
            updated or order,
            stage="dealer_received",
            payload={"orderCode": order_code, "receivedBy": "dealer"},
        )
        delivered_tx_hash = _write_stage_event(
            updated or order,
            stage="delivered",
            payload={"orderCode": order_code, "deliveredTo": "dealer"},
        )
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc

    notification_service.publish(
        user_id="retail_shop",
        title="Order ready for retail",
        message=f"{order_code} received by dealer and ready for retail handoff.",
        metadata={"orderCode": order_code, "txHash": tx_hash, "deliveredTxHash": delivered_tx_hash},
    )
    return {"order": updated, "txHash": tx_hash, "deliveredTxHash": delivered_tx_hash}


@router.patch("/orders/{order_code}/retail-receive", dependencies=[Depends(require_roles(UserRole.admin, UserRole.retail_shop, UserRole.dealer))])
def retail_receive(order_code: str) -> dict:
    order = get_order(order_code)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        updated = update_order_stage(
            order_code,
            stage="retail_received",
            status="retail_received",
            retail_received=True,
        )
        tx_hash = _write_stage_event(
            updated or order,
            stage="retail_received",
            payload={"orderCode": order_code, "receivedBy": "retail_shop"},
        )
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc
    return {"order": updated, "txHash": tx_hash}


@router.get("/orders/pipeline", dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer, UserRole.manufacturer, UserRole.transporter, UserRole.retail_shop))])
def pipeline_orders(limit: int = Query(100, ge=1, le=500)) -> dict:
    return {"items": _pipeline_rows(limit=limit)}


@router.get("/orders/recent", dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))])
def recent_orders() -> dict:
    rows = _pipeline_rows(limit=20)
    orders = [
        {
            "orderId": item["orderCode"],
            "retailer": item["retailer"],
            "amount": format_inr(float(item["amount"]), decimals=2),
            "status": str(item["status"]).replace("_", " ").title(),
            "date": (item["createdAt"] or "")[:10],
            "shipmentId": item["shipmentId"],
            "currentStage": item["currentStage"],
        }
        for item in rows
    ]
    return {"orders": orders[:10]}


@router.get("/orders/trends", dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))])
def order_trends() -> dict:
    rows = _pipeline_rows(limit=200)
    base = max(len(rows), 1) * 2
    trends = [max(0, base + ((index % 3) - 1) * 2 + (index // 2)) for index in range(7)]
    return {"trends": trends}


@router.get("/low-stock", dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))])
def low_stock_alerts() -> dict:
    items = [item for item in _inventory_items() if item["stockStatus"] != "In Stock"]
    return {"items": items}


@router.get("/inventory", dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))])
def inventory() -> dict:
    return {"items": _inventory_items()}


@router.get("/arrivals", dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))])
def arrivals() -> dict:
    try:
        return {"shipments": list_dealer_arrivals()}
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc


@router.get("/reorder-recommendations", dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))])
def ai_reorder_recommendations(days: int = Query(30, ge=7, le=120)) -> dict:
    try:
        items = reorder_recommendations(days=days)
        api_key = get_settings().anthropic_api_key
        if api_key:
            items = predict_low_stock(items, api_key)
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc
    return {"items": items}


@router.get("/analytics", dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer))])
def analytics(time_range: str = Query("30d", alias="range")) -> dict:
    rows = _pipeline_rows(limit=500)
    points = 7 if time_range == "7d" else 90 if time_range == "90d" else 30
    delivered_count = sum(1 for item in rows if "deliver" in str(item.get("status")))
    in_transit_count = sum(1 for item in rows if "transit" in str(item.get("status")))
    pending_count = max(len(rows) - delivered_count - in_transit_count, 0)
    inventory_items = _inventory_items()
    inventory_value = sum(float(item["unitPrice"]) * int(item["currentStock"]) for item in inventory_items)

    revenue_base = max(inventory_value * 0.012, 420.0)
    flow_factor = (delivered_count * 35.0) + (in_transit_count * 22.0) - (pending_count * 14.0)
    revenue = [
        max(0.0, round(revenue_base + (index * max(flow_factor / max(points, 1), 4.0)) + ((index % 4) - 1.5) * 18.0, 2))
        for index in range(points)
    ]

    category_counts: dict[str, int] = {}
    for item in inventory_items:
        category = str(item.get("category") or "Other")
        category_counts[category] = category_counts.get(category, 0) + int(item.get("currentStock", 0))

    top_products = [
        {"label": category, "value": value, "color": color}
        for (category, value), color in zip(
            sorted(category_counts.items(), key=lambda kv: kv[1], reverse=True),
            ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#0ea5e9"],
        )
    ]

    return {
        "revenue": revenue,
        "topProducts": top_products,
        "orderStatus": [
            {"label": "Delivered", "value": delivered_count, "color": "#22c55e"},
            {"label": "Dispatched", "value": in_transit_count, "color": "#0ea5e9"},
            {"label": "Pending", "value": pending_count, "color": "#f59e0b"},
        ],
        "categoryMix": top_products,
    }
