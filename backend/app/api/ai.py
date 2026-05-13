from __future__ import annotations

<<<<<<< HEAD
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.middleware import require_roles
from app.models.user import UserRole
from app.services.ai_service import (
    ai_status,
    analyse_supplier_risk,
    check_inventory_alerts,
    detect_shipment_anomalies,
    forecast_with_insights,
    optimise_delivery_route,
)
=======
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, conlist

from app.core.middleware import get_current_payload
from app.services.ai_service import ai_status, aforecast_with_insights
>>>>>>> 2e0225834c4e9b35737288da65ee57f107aed6aa

router = APIRouter(prefix="/ai", tags=["ai"])


class ForecastRequest(BaseModel):
<<<<<<< HEAD
    product_name: str = Field(default="Product")
    history: List[float] = Field(default_factory=list)
    horizon: int = Field(default=30, ge=1, le=365)
    context: str = Field(default="")


class SupplierRiskRequest(BaseModel):
    supplier_name: str = Field(min_length=2, max_length=160)
    supplier_data: Dict[str, Any] = Field(default_factory=dict)
    news_snippets: List[str] = Field(default_factory=list)


class RouteOptimiseRequest(BaseModel):
    warehouse: str = Field(min_length=2, max_length=160)
    stops: List[Dict[str, Any]] = Field(default_factory=list)
    constraints: Dict[str, Any] = Field(default_factory=dict)


class InventoryAlertsRequest(BaseModel):
    inventory_items: List[Dict[str, Any]] = Field(default_factory=list)
    avg_daily_demand: Dict[str, float] = Field(default_factory=dict)


class ShipmentAnomaliesRequest(BaseModel):
    tracking_id: str = Field(min_length=2, max_length=80)
    tracking_events: List[Dict[str, Any]] = Field(default_factory=list)
    expected_delivery: str = Field(default="")


@router.get("/status", dependencies=[Depends(require_roles(UserRole.admin))])
def status() -> dict:
    return ai_status()


@router.post(
    "/forecast-with-insights",
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer))],
)
def forecast(data: ForecastRequest) -> dict:
    return forecast_with_insights(
        product_name=data.product_name,
        history=list(data.history or []),
        horizon=int(data.horizon),
        context=str(data.context or ""),
    )


@router.post(
    "/supplier-risk",
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer, UserRole.manufacturer))],
)
def supplier_risk(data: SupplierRiskRequest) -> dict:
    return analyse_supplier_risk(
        supplier_name=data.supplier_name,
        supplier_data=dict(data.supplier_data or {}),
        news_snippets=list(data.news_snippets or []),
    )


@router.post(
    "/route-optimise",
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.transporter))],
)
def route_optimise(data: RouteOptimiseRequest) -> dict:
    return optimise_delivery_route(
        warehouse=data.warehouse,
        stops=list(data.stops or []),
        constraints=dict(data.constraints or {}),
    )


@router.post(
    "/inventory-alerts",
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.dealer, UserRole.retail_shop))],
)
def inventory_alerts(data: InventoryAlertsRequest) -> dict:
    return check_inventory_alerts(
        inventory_items=list(data.inventory_items or []),
        avg_daily_demand=dict(data.avg_daily_demand or {}),
    )


@router.post(
    "/shipment-anomalies",
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.transporter))],
)
def shipment_anomalies(data: ShipmentAnomaliesRequest) -> dict:
    return detect_shipment_anomalies(
        tracking_id=data.tracking_id,
        tracking_events=list(data.tracking_events or []),
        expected_delivery=str(data.expected_delivery or ""),
=======
    product_name: str = Field(min_length=1, max_length=120)
    history: conlist(float, min_length=1)  # list of numeric demand history
    horizon: int = Field(default=30, ge=1, le=365)
    context: Optional[str] = Field(default="", max_length=2000)


@router.get("/status")
async def ai_status_route(_: dict = Depends(get_current_payload)) -> dict:
    """Return current AI provider configuration status."""
    return ai_status()


@router.post("/forecast-with-insights")
async def forecast_with_insights_endpoint(
    data: ForecastRequest,
    _: dict = Depends(get_current_payload),
) -> dict:
    """
    Generate a demand forecast with narrative insights.
    Requires authentication; works with configured AI provider or falls back to baseline forecast.
    """
    return await aforecast_with_insights(
        product_name=data.product_name,
        history=list(data.history),
        horizon=data.horizon,
        context=data.context or "",
>>>>>>> 2e0225834c4e9b35737288da65ee57f107aed6aa
    )
