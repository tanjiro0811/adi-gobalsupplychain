from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.middleware import require_roles
from app.models.user import UserRole
from app.services.ai_service import predict_delay_risk
from app.services.notification_service import notification_service
from app.services.state_service import shipments

router = APIRouter(prefix="/tracking", tags=["tracking"])


class ShipmentCreateRequest(BaseModel):
    shipment_id: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    status: str = "created"


class ShipmentLocationUpdateRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    status: str = "in_transit"


class DelayRiskRequest(BaseModel):
    distance_km: float = Field(gt=0)
    weather_score: float = Field(ge=0, le=1)
    traffic_score: float = Field(ge=0, le=1)


def get_shipments_snapshot() -> dict:
    return shipments


def _trend_labels(points: int) -> list[str]:
    if points == 7:
        return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    return [f"D-{points - idx}" for idx in range(points)]


@router.post("/shipments", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer))])
def create_shipment(data: ShipmentCreateRequest) -> dict:
    if data.shipment_id in shipments:
        raise HTTPException(status_code=409, detail="Shipment ID already exists")

    shipments[data.shipment_id] = {
        "lat": data.lat,
        "lng": data.lng,
        "status": data.status,
    }
    return {"shipment_id": data.shipment_id, **shipments[data.shipment_id]}


@router.patch("/shipments/{shipment_id}", dependencies=[Depends(require_roles(UserRole.admin, UserRole.transporter))])
def update_shipment_location(shipment_id: str, data: ShipmentLocationUpdateRequest) -> dict:
    shipment = shipments.get(shipment_id)
    if shipment is None:
        raise HTTPException(status_code=404, detail="Shipment not found")

    shipment.update({"lat": data.lat, "lng": data.lng, "status": data.status})
    notification_service.publish(
        user_id="tracking",
        title="Shipment updated",
        message=f"Shipment {shipment_id} is now {data.status}",
    )
    return {"shipment_id": shipment_id, **shipment}


@router.get("/live-gps", dependencies=[Depends(require_roles(UserRole.admin, UserRole.transporter, UserRole.dealer, UserRole.retail_shop))])
def get_live_gps() -> dict:
    return {"shipments": shipments}


@router.get("/map", dependencies=[Depends(require_roles(UserRole.admin, UserRole.transporter, UserRole.dealer, UserRole.retail_shop))])
def get_map_data() -> dict:
    points = [
        {"shipment_id": shipment_id, **data}
        for shipment_id, data in shipments.items()
    ]
    return {"center": {"lat": 20.5937, "lng": 78.9629}, "points": points}


@router.post("/ai-delay-risk", dependencies=[Depends(require_roles(UserRole.admin, UserRole.transporter, UserRole.dealer))])
def ai_delay_risk(data: DelayRiskRequest) -> dict:
    risk = predict_delay_risk(
        distance_km=data.distance_km,
        weather_score=data.weather_score,
        traffic_score=data.traffic_score,
    )
    return {"delay_risk": risk}


@router.get(
    "/analytics",
    dependencies=[Depends(require_roles(UserRole.admin, UserRole.transporter, UserRole.dealer, UserRole.retail_shop))],
)
def tracking_analytics(time_range: str = Query("7d", alias="range")) -> dict:
    points = 30 if time_range == "30d" else 7
    labels = _trend_labels(points)
    shipment_rows = list(shipments.values())
    total_shipments = len(shipment_rows)
    delayed = len([item for item in shipment_rows if "delay" in str(item.get("status", "")).lower()])
    in_transit = len([item for item in shipment_rows if "transit" in str(item.get("status", "")).lower()])
    completed = max(total_shipments - delayed - in_transit, 0)

    baseline = max(total_shipments, 1) * 18
    delivery_trends = [
        {
            "label": labels[index],
            "value": baseline + ((index % 4) * 3) + (index // 5),
        }
        for index in range(points)
    ]

    projected = max(total_shipments + max(1, round(total_shipments * 0.15)), 1)
    forecast_series = [
        {"label": "Today", "value": max(total_shipments, 1)},
        {"label": "D+1", "value": max(round(total_shipments * 1.05), 1)},
        {"label": "D+2", "value": max(round(total_shipments * 1.1), 1)},
        {"label": "D+3", "value": projected},
    ]

    trend_percent = ((projected - max(total_shipments, 1)) / max(total_shipments, 1)) * 100
    return {
        "deliveryTrends": delivery_trends,
        "statusData": [
            {"label": "In Transit", "value": in_transit, "color": "#0ea5e9"},
            {"label": "Delayed", "value": delayed, "color": "#f97316"},
            {"label": "Completed", "value": completed, "color": "#22c55e"},
        ],
        "forecast": {
            "today": total_shipments,
            "projected": projected,
            "trend": f"+{round(trend_percent)}%",
            "series": forecast_series,
        },
    }
