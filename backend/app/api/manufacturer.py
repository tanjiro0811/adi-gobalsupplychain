from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.middleware import require_roles
from app.models.user import UserRole
from app.services.ai_service import predict_demand
from app.services.blockchain_service import generate_product_hash
from app.services.notification_service import notification_service
from app.services.state_service import batches, products

router = APIRouter(prefix="/manufacturer", tags=["manufacturer"])


class ProductCreateRequest(BaseModel):
    sku: str
    name: str
    quantity: int = Field(ge=0, default=0)
    price: float = Field(gt=0)


class BatchCreateRequest(BaseModel):
    product_sku: str
    quantity: int = Field(gt=0)


def _category_from_sku(sku: str) -> str:
    normalized = sku.upper()
    if "KIT" in normalized:
        return "PPE"
    if "IV" in normalized or "MED" in normalized:
        return "Medical"
    if "DIAG" in normalized or "LAB" in normalized:
        return "Diagnostics"
    return "First Aid"


@router.post("/products", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer))])
def create_product(data: ProductCreateRequest) -> dict:
    if any(item["sku"] == data.sku for item in products):
        raise HTTPException(status_code=409, detail="SKU already exists")

    next_id = (max((item["id"] for item in products), default=0) + 1)
    product = {
        "id": next_id,
        "sku": data.sku,
        "name": data.name,
        "quantity": data.quantity,
        "price": data.price,
    }
    products.append(product)
    notification_service.publish(
        user_id="manufacturer",
        title="Product created",
        message=f"Product {data.sku} created with quantity {data.quantity}",
    )
    return product


@router.get("/products", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer, UserRole.retail_shop))])
def list_products() -> dict:
    return {"items": products, "count": len(products)}


@router.post("/batches", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer))])
def create_batch(data: BatchCreateRequest) -> dict:
    product = next((item for item in products if item["sku"] == data.product_sku), None)
    if product is None:
        raise HTTPException(status_code=404, detail="Product SKU not found")

    batch_id = f"B-{uuid4().hex[:8].upper()}"
    payload = {"sku": data.product_sku, "quantity": data.quantity}
    ledger_hash = generate_product_hash(
        product_id=str(product["id"]),
        batch_id=batch_id,
        payload=payload,
    )

    batch = {
        "batch_id": batch_id,
        "product_sku": data.product_sku,
        "quantity": data.quantity,
        "ledger_hash": ledger_hash,
        "status": "created",
    }
    batches.append(batch)
    product["quantity"] += data.quantity

    notification_service.publish(
        user_id="manufacturer",
        title="Batch created",
        message=f"Batch {batch_id} created for {data.product_sku}",
    )

    return batch


@router.get("/batches", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer))])
def list_batches() -> dict:
    return {"items": batches, "count": len(batches)}


@router.get("/ai-forecast", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer))])
def ai_forecast(
    history: str = Query("80,95,110,132,141,150"),
    horizon: int = Query(3, ge=1, le=12),
) -> dict:
    values = [float(value.strip()) for value in history.split(",") if value.strip()]
    forecast = predict_demand(values, horizon=horizon)
    return {"history": values, "forecast": forecast}


@router.get("/analytics", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer))])
def analytics() -> dict:
    history = [float(item.get("quantity", 0)) for item in batches[-6:]]
    if not history:
        history = [80.0, 95.0, 110.0, 132.0, 141.0, 150.0]

    forecast = predict_demand(history, horizon=3)
    forecast_series = [int(round(value)) for value in [*history, *forecast]]

    product_total = sum(int(item.get("quantity", 0)) for item in products)
    total_output = product_total
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
        category = _category_from_sku(str(item.get("sku", "")))
        category_totals[category] += int(item.get("quantity", 0))

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
            "totalOutput": total_output,
            "forecastNext": forecast_series[-1] if forecast_series else 0,
        },
    }
