from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.middleware import require_roles
from app.models.user import UserRole
from app.services.ai_service import predict_demand
from app.services.blockchain_service import generate_product_hash, generate_tx_hash
from app.services.database_service import (
    DatabaseConflictError,
    DatabaseError,
    append_pipeline_event,
    create_batch as db_create_batch,
    create_ledger_record,
    create_or_update_shipment,
    create_product as db_create_product,
    get_order,
    get_product_by_sku,
    get_sales_history,
    list_batches as db_list_batches,
    list_products as db_list_products,
    update_order_stage,
)
from app.services.notification_service import notification_service

router = APIRouter(prefix="/manufacturer", tags=["manufacturer"])


class ProductCreateRequest(BaseModel):
    sku: str
    name: str
    quantity: int = Field(ge=0, default=0)
    price: float = Field(gt=0)


class BatchCreateRequest(BaseModel):
    product_sku: str
    quantity: int = Field(gt=0)
    order_code: Optional[str] = None


class AssignTransporterRequest(BaseModel):
    transporter_id: str = Field(default="transporter")
    shipment_id: str
    origin: str
    destination: str
    eta: str
    vehicle_number: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


def _production_history(points: int = 6) -> list[float]:
    batches = db_list_batches()
    recent_batches = [float(item.get("quantity", 0)) for item in batches[:points]]
    if recent_batches:
        return list(reversed(recent_batches))

    products = db_list_products()
    total_units = sum(float(item.get("quantity", 0)) for item in products)
    if total_units <= 0:
        return [0.0 for _ in range(points)]

    weights = [0.68, 0.76, 0.84, 0.91, 0.97, 1.0]
    return [round(total_units * weights[idx] / points, 2) for idx in range(points)]


@router.post(
    "/products",
    dependencies=[
        Depends(
            require_roles(
                UserRole.admin,
                UserRole.manufacturer,
                UserRole.transporter,
                UserRole.dealer,
                UserRole.retail_shop,
            )
        )
    ],
)
def create_product(data: ProductCreateRequest) -> dict:
    try:
        created = db_create_product(
            sku=data.sku,
            name=data.name,
            quantity=data.quantity,
            price=data.price,
        )
    except DatabaseConflictError as exc:
        raise HTTPException(status_code=409, detail="SKU already exists") from exc
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc

    notification_service.publish(
        user_id="manufacturer",
        title="Product created",
        message=f"Product {created['sku']} created with quantity {created['quantity']}",
        metadata={"sku": created["sku"]},
    )
    return created


@router.get("/products", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer, UserRole.retail_shop))])
def list_products() -> dict:
    items = db_list_products()
    return {"items": items, "count": len(items)}


@router.post("/batches", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer))])
def create_batch(data: BatchCreateRequest) -> dict:
    product = get_product_by_sku(data.product_sku)
    if product is None:
        raise HTTPException(status_code=404, detail="Product SKU not found")

    batch_id = f"B-{uuid4().hex[:8].upper()}"
    payload = {
        "sku": data.product_sku,
        "quantity": data.quantity,
        "orderCode": data.order_code,
        "event": "manufacturer_batch_created",
    }
    ledger_hash = generate_product_hash(
        product_id=str(product["id"]),
        batch_id=batch_id,
        payload=payload,
    )
    tx_hash = generate_tx_hash(payload)

    try:
        batch = db_create_batch(
            batch_id=batch_id,
            product_sku=data.product_sku,
            quantity=data.quantity,
            ledger_hash=ledger_hash,
            tx_hash=tx_hash,
            status="created",
            order_code=data.order_code,
        )
        create_ledger_record(
            product_id=str(product["id"]),
            batch_id=batch_id,
            event_stage="manufacturer_batch_created",
            payload=payload,
            ledger_hash=ledger_hash,
            tx_hash=tx_hash,
        )

        if data.order_code:
            order = update_order_stage(
                data.order_code,
                stage="manufacturer_batch_created",
                status="manufacturer_batch_created",
                batch_id=batch_id,
                manufacturer_id="manufacturer",
            )
            if order:
                append_pipeline_event(
                    order_code=data.order_code,
                    product_sku=data.product_sku,
                    stage="manufacturer_batch_created",
                    tx_hash=tx_hash,
                    payload={
                        "batchId": batch_id,
                        "quantity": data.quantity,
                    },
                )
                notification_service.publish(
                    user_id="dealer",
                    title="Batch created",
                    message=f"{data.order_code} batch {batch_id} is ready for transporter assignment.",
                    metadata={"orderCode": data.order_code, "txHash": tx_hash, "batchId": batch_id},
                )
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc

    notification_service.publish(
        user_id="manufacturer",
        title="Batch created",
        message=f"Batch {batch_id} created for {data.product_sku}",
        metadata={"batchId": batch_id, "txHash": tx_hash},
    )
    return {
        **batch,
        "txHash": tx_hash,
    }


@router.patch(
    "/orders/{order_code}/create-batch",
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer))],
)
def create_batch_for_order(order_code: str, data: BatchCreateRequest) -> dict:
    payload = BatchCreateRequest(
        product_sku=data.product_sku,
        quantity=data.quantity,
        order_code=order_code,
    )
    return create_batch(payload)


@router.patch(
    "/orders/{order_code}/assign-transporter",
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer))],
)
def assign_transporter(order_code: str, data: AssignTransporterRequest) -> dict:
    order = get_order(order_code)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    payload = {
        "orderCode": order_code,
        "shipmentId": data.shipment_id,
        "transporterId": data.transporter_id,
        "vehicleNumber": data.vehicle_number,
        "event": "transporter_assigned",
    }
    tx_hash = generate_tx_hash(payload)
    ledger_hash = generate_product_hash(
        product_id=str(order.get("product_sku")),
        batch_id=str(order.get("batch_id") or "NA"),
        payload=payload,
    )
    dispatched_payload = {
        "orderCode": order_code,
        "shipmentId": data.shipment_id,
        "vehicleNumber": data.vehicle_number,
        "event": "dispatched",
    }
    dispatched_tx_hash = generate_tx_hash(dispatched_payload)
    dispatched_ledger_hash = generate_product_hash(
        product_id=str(order.get("product_sku")),
        batch_id=str(order.get("batch_id") or "NA"),
        payload=dispatched_payload,
    )

    try:
        create_or_update_shipment(
            shipment_id=data.shipment_id,
            order_code=order_code,
            lat=data.lat,
            lng=data.lng,
            status="assigned",
            origin=data.origin,
            destination=data.destination,
            eta=data.eta,
            vehicle_number=data.vehicle_number,
            assignment_status="Assigned",
        )
        updated = update_order_stage(
            order_code,
            stage="transporter_assigned",
            status="transporter_assigned",
            transporter_id=data.transporter_id,
            shipment_id=data.shipment_id,
        )
        create_ledger_record(
            product_id=str(order.get("product_sku")),
            batch_id=str(order.get("batch_id") or "NA"),
            event_stage="transporter_assigned",
            payload=payload,
            ledger_hash=ledger_hash,
            tx_hash=tx_hash,
        )
        append_pipeline_event(
            order_code=order_code,
            product_sku=str(order.get("product_sku")),
            stage="transporter_assigned",
            tx_hash=tx_hash,
            payload=payload,
            shipment_id=data.shipment_id,
            lat=data.lat,
            lng=data.lng,
        )
        create_ledger_record(
            product_id=str(order.get("product_sku")),
            batch_id=str(order.get("batch_id") or "NA"),
            event_stage="dispatched",
            payload=dispatched_payload,
            ledger_hash=dispatched_ledger_hash,
            tx_hash=dispatched_tx_hash,
        )
        append_pipeline_event(
            order_code=order_code,
            product_sku=str(order.get("product_sku")),
            stage="dispatched",
            tx_hash=dispatched_tx_hash,
            payload=dispatched_payload,
            shipment_id=data.shipment_id,
            lat=data.lat,
            lng=data.lng,
        )
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc

    notification_service.publish(
        user_id=data.transporter_id,
        title="Shipment assigned",
        message=f"{order_code} assigned with shipment {data.shipment_id}.",
        metadata={"orderCode": order_code, "shipmentId": data.shipment_id, "txHash": tx_hash},
    )
    notification_service.publish(
        user_id="dealer",
        title="Transporter assigned",
        message=f"{order_code} moved to transporter assignment.",
        metadata={"orderCode": order_code, "shipmentId": data.shipment_id, "txHash": tx_hash},
    )

    return {
        "order": updated,
        "shipmentId": data.shipment_id,
        "txHash": tx_hash,
        "dispatchTxHash": dispatched_tx_hash,
    }


@router.get("/batches", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer))])
def list_batches() -> dict:
    items = db_list_batches()
    return {"items": items, "count": len(items)}


@router.get("/ai-forecast", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer))])
def ai_forecast(
    history: str = Query(""),
    horizon: int = Query(3, ge=1, le=12),
) -> dict:
    values = [float(value.strip()) for value in str(history).split(",") if value.strip()]
    if not values:
        # Real sales history feed from DB (last 30 sale records).
        sales = get_sales_history(days=60)
        values = [float(item.get("units_sold", 0)) for item in sales[-30:]]
    if not values:
        values = _production_history(points=6)
    forecast = predict_demand(values, horizon=horizon)
    return {"history": values, "forecast": forecast}


@router.get("/analytics", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer))])
def analytics() -> dict:
    products = db_list_products()
    batches = db_list_batches()
    history = _production_history(points=6)

    forecast = predict_demand(history, horizon=3)
    forecast_series = [int(round(value)) for value in [*history, *forecast]]
    product_total = sum(int(item.get("quantity", 0)) for item in products)
    trend_boost = min(max(len(batches), 1), 12)

    efficiency_trend = [
        {"label": "Week 1", "value": min(99, 88 + trend_boost)},
        {"label": "Week 2", "value": min(99, 89 + trend_boost)},
        {"label": "Week 3", "value": min(99, 90 + trend_boost)},
        {"label": "Week 4", "value": min(99, 91 + trend_boost)},
    ]

    defect_base = max(0.8, 2.8 - (trend_boost * 0.11))
    defect_trend = [
        {"label": "Jan", "value": round(defect_base + 0.4, 2)},
        {"label": "Feb", "value": round(defect_base + 0.2, 2)},
        {"label": "Mar", "value": round(defect_base + 0.1, 2)},
        {"label": "Apr", "value": round(defect_base, 2)},
    ]

    category_totals = {
        "PPE": 0,
        "Medical": 0,
        "First Aid": 0,
        "Diagnostics": 0,
    }
    for item in products:
        sku = str(item.get("sku", "")).upper()
        if "KIT" in sku:
            category_totals["PPE"] += int(item.get("quantity", 0))
        elif "IV" in sku or "MED" in sku:
            category_totals["Medical"] += int(item.get("quantity", 0))
        elif "DIAG" in sku or "LAB" in sku:
            category_totals["Diagnostics"] += int(item.get("quantity", 0))
        else:
            category_totals["First Aid"] += int(item.get("quantity", 0))

    category_production = [
        {"label": "PPE", "value": category_totals["PPE"]},
        {"label": "Medical", "value": category_totals["Medical"]},
        {"label": "First Aid", "value": category_totals["First Aid"]},
        {"label": "Diagnostics", "value": category_totals["Diagnostics"]},
    ]

    avg_efficiency = round(sum(item["value"] for item in efficiency_trend) / len(efficiency_trend), 1)
    avg_defect_rate = round(sum(item["value"] for item in defect_trend) / len(defect_trend), 2)

    return {
        "forecastSeries": forecast_series,
        "efficiencyTrend": efficiency_trend,
        "defectTrend": defect_trend,
        "categoryProduction": category_production,
        "stats": {
            "avgEfficiency": f"{avg_efficiency}%",
            "avgDefectRate": f"{avg_defect_rate}%",
            "totalOutput": product_total,
            "forecastNext": forecast_series[-1] if forecast_series else 0,
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
        },
    }
