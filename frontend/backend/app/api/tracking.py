from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.middleware import require_roles
from app.models.user import UserRole
from app.services.ai_service import predict_delay_risk
from app.services.blockchain_service import generate_product_hash, generate_tx_hash
from app.services.database_service import (
    DatabaseError,
    append_pipeline_event,
    create_ledger_record,
    create_or_update_shipment,
    get_order,
    list_shipments,
    record_shipment_event,
    update_order_stage,
    update_shipment_location,
)
from app.services.notification_service import notification_service

router = APIRouter(prefix="/tracking", tags=["tracking"])


class ShipmentCreateRequest(BaseModel):
    shipment_id: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    status: str = "created"
    order_code: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    eta: Optional[str] = None
    vehicle_number: Optional[str] = None


class ShipmentLocationUpdateRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    status: str = "in_transit"


class DelayRiskRequest(BaseModel):
    distance_km: float = Field(gt=0)
    weather_score: float = Field(ge=0, le=1)
    traffic_score: float = Field(ge=0, le=1)


class OrderStageUpdateRequest(BaseModel):
    stage: str = Field(pattern=r"^[a-z_]+$")
    shipment_id: Optional[str] = None
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)


def get_shipments_snapshot() -> dict:
    return list_shipments()


def _trend_labels(points: int) -> list[str]:
    if points == 7:
        return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    return [f"D-{points - idx}" for idx in range(points)]


def _status_text(value: object) -> str:
    return str(value or "unknown").replace("_", " ").strip().lower()


def _as_float(value: object) -> Optional[float]:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed


def _has_gps_signal(data: dict) -> bool:
    lat = _as_float(data.get("lat"))
    lng = _as_float(data.get("lng"))
    return lat is not None and lng is not None


def _timestamp_epoch(value: object) -> float:
    raw = str(value or "").strip()
    if not raw:
        return 0.0
    try:
        normalized = raw.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized).timestamp()
    except ValueError:
        return 0.0


def build_tracking_analytics_snapshot(shipment_data: dict[str, dict], time_range: str = "7d") -> dict:
    points = 30 if time_range == "30d" else 7
    labels = _trend_labels(points)
    shipment_rows = list((shipment_data or {}).values())
    total_shipments = len(shipment_rows)

    delayed = 0
    in_transit = 0
    completed_by_status = 0
    active_vehicles = 0
    pending_assignments = 0

    for item in shipment_rows:
        status = _status_text(item.get("status"))
        if "delay" in status:
            delayed += 1
        if "transit" in status:
            in_transit += 1
        if "deliver" in status or "complete" in status:
            completed_by_status += 1
        if _has_gps_signal(item):
            active_vehicles += 1

        assignment_status = str(item.get("assignmentStatus") or item.get("assignment", {}).get("status") or "").lower()
        if "pending" in assignment_status or "unassigned" in assignment_status:
            pending_assignments += 1

    completed = completed_by_status if completed_by_status else max(total_shipments - delayed - in_transit, 0)
    gps_offline = max(total_shipments - active_vehicles, 0)

    baseline = max(total_shipments, 1) * 16
    momentum = max(in_transit + completed, 1)
    delay_penalty = delayed * 2
    delivery_trends = [
        {
            "label": labels[index],
            "value": max(0, round(baseline + (index * (momentum * 0.55)) - delay_penalty + ((index % 3) - 1) * 2)),
        }
        for index in range(points)
    ]

    if total_shipments == 0:
        projected = 0
    else:
        growth_delta = max(1, round((momentum - delayed) * 0.35))
        projected = max(total_shipments, total_shipments + growth_delta)

    forecast_series = [
        {"label": "Today", "value": total_shipments},
        {"label": "D+1", "value": round(total_shipments + (projected - total_shipments) * 0.34)},
        {"label": "D+2", "value": round(total_shipments + (projected - total_shipments) * 0.68)},
        {"label": "D+3", "value": projected},
    ]

    trend_percent = 0
    if total_shipments > 0:
        trend_percent = round(((projected - total_shipments) / total_shipments) * 100)

    delay_rate = 0
    if total_shipments > 0:
        delay_rate = round((delayed / total_shipments) * 100)

    return {
        "deliveryTrends": delivery_trends,
        "statusData": [
            {"label": "In Transit", "value": in_transit, "color": "#0ea5e9"},
            {"label": "Delayed", "value": delayed, "color": "#f97316"},
            {"label": "Completed", "value": completed, "color": "#22c55e"},
            {"label": "GPS Offline", "value": gps_offline, "color": "#64748b"},
        ],
        "forecast": {
            "today": total_shipments,
            "projected": projected,
            "trend": f"{trend_percent:+d}%",
            "series": forecast_series,
        },
        "summary": {
            "totalShipments": total_shipments,
            "activeVehicles": active_vehicles,
            "inTransit": in_transit,
            "delayed": delayed,
            "completed": completed,
            "gpsOffline": gps_offline,
            "pendingAssignments": pending_assignments,
            "delayRate": delay_rate,
        },
    }


def build_tracking_alerts(shipment_data: dict[str, dict]) -> list[dict]:
    alerts: list[dict] = []
    generated_at = datetime.now(timezone.utc).isoformat()

    for shipment_id, item in (shipment_data or {}).items():
        status = _status_text(item.get("status"))
        origin = str(item.get("origin") or "Unknown origin")
        destination = str(item.get("destination") or "Unknown destination")
        timestamp = str(item.get("timestamp") or generated_at)

        if "delay" in status:
            alerts.append(
                {
                    "id": f"{shipment_id}:delay",
                    "shipmentId": shipment_id,
                    "severity": "critical",
                    "title": "Delay alert",
                    "message": f"{shipment_id} is delayed on route {origin} to {destination}.",
                    "timestamp": timestamp,
                }
            )

        if not _has_gps_signal(item):
            alerts.append(
                {
                    "id": f"{shipment_id}:gps",
                    "shipmentId": shipment_id,
                    "severity": "warning",
                    "title": "GPS signal missing",
                    "message": f"{shipment_id} has no live GPS signal.",
                    "timestamp": timestamp,
                }
            )

        assignment_status = str(item.get("assignmentStatus") or item.get("assignment", {}).get("status") or "").lower()
        if "pending" in assignment_status or "unassigned" in assignment_status:
            alerts.append(
                {
                    "id": f"{shipment_id}:assignment",
                    "shipmentId": shipment_id,
                    "severity": "info",
                    "title": "Pending assignment",
                    "message": f"{shipment_id} is pending transporter assignment.",
                    "timestamp": timestamp,
                }
            )

    severity_rank = {"critical": 0, "warning": 1, "info": 2}
    alerts.sort(
        key=lambda event: (
            severity_rank.get(str(event.get("severity")), 9),
            -_timestamp_epoch(event.get("timestamp")),
        )
    )
    return alerts


def get_tracking_socket_payload(time_range: str = "7d") -> dict:
    snapshot = get_shipments_snapshot()
    return {
        "type": "gps:update",
        "shipments": snapshot,
        "analytics": build_tracking_analytics_snapshot(snapshot, time_range=time_range),
        "alerts": build_tracking_alerts(snapshot),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/shipments", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer))])
def create_shipment(data: ShipmentCreateRequest) -> dict:
    try:
        item = create_or_update_shipment(
            shipment_id=data.shipment_id,
            order_code=data.order_code,
            lat=data.lat,
            lng=data.lng,
            status=data.status,
            origin=data.origin,
            destination=data.destination,
            eta=data.eta,
            vehicle_number=data.vehicle_number,
            assignment_status="Assigned",
        )
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc
    return {"shipment_id": data.shipment_id, **item}


@router.patch("/shipments/{shipment_id}", dependencies=[Depends(require_roles(UserRole.admin, UserRole.transporter))])
def patch_shipment_location(shipment_id: str, data: ShipmentLocationUpdateRequest) -> dict:
    try:
        shipment = update_shipment_location(
            shipment_id=shipment_id,
            lat=data.lat,
            lng=data.lng,
            status=data.status,
        )
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc

    if shipment is None:
        raise HTTPException(status_code=404, detail="Shipment not found")

    notification_service.publish(
        user_id="dealer",
        title="Shipment GPS update",
        message=f"{shipment_id} updated to {data.status}.",
        metadata={"shipmentId": shipment_id, "lat": data.lat, "lng": data.lng},
    )
    return {"shipment_id": shipment_id, **shipment}


@router.patch("/orders/{order_code}/stage", dependencies=[Depends(require_roles(UserRole.admin, UserRole.transporter, UserRole.dealer))])
def update_order_stage_from_tracking(order_code: str, data: OrderStageUpdateRequest) -> dict:
    order = get_order(order_code)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    shipment_id = data.shipment_id or order.get("shipment_id")
    payload = {
        "orderCode": order_code,
        "stage": data.stage,
        "shipmentId": shipment_id,
        "lat": data.lat,
        "lng": data.lng,
    }
    tx_hash = generate_tx_hash(payload)
    ledger_hash = generate_product_hash(
        product_id=str(order.get("product_sku")),
        batch_id=str(order.get("batch_id") or "NA"),
        payload=payload,
    )

    try:
        updated_order = update_order_stage(
            order_code,
            stage=data.stage,
            status=data.stage,
            shipment_id=shipment_id,
            dealer_received=data.stage == "dealer_received",
            retail_received=data.stage == "retail_received",
        )
        create_ledger_record(
            product_id=str(order.get("product_sku")),
            batch_id=str(order.get("batch_id") or "NA"),
            event_stage=data.stage,
            payload=payload,
            ledger_hash=ledger_hash,
            tx_hash=tx_hash,
        )
        append_pipeline_event(
            order_code=order_code,
            product_sku=str(order.get("product_sku")),
            stage=data.stage,
            tx_hash=tx_hash,
            payload=payload,
            shipment_id=shipment_id,
            lat=data.lat,
            lng=data.lng,
        )

        if shipment_id and data.lat is not None and data.lng is not None:
            update_shipment_location(
                shipment_id=shipment_id,
                lat=data.lat,
                lng=data.lng,
                status=data.stage,
            )
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc

    if data.stage in {"in_transit", "dealer_received", "retail_received"}:
        target = "dealer" if data.stage != "retail_received" else "retail_shop"
        notification_service.publish(
            user_id=target,
            title=f"Order stage: {data.stage.replace('_', ' ').title()}",
            message=f"{order_code} is now {data.stage.replace('_', ' ')}.",
            metadata={"orderCode": order_code, "txHash": tx_hash},
        )

    return {"order": updated_order, "txHash": tx_hash}


@router.get("/live-gps", dependencies=[Depends(require_roles(UserRole.admin, UserRole.transporter, UserRole.dealer, UserRole.retail_shop))])
def get_live_gps() -> dict:
    return {"shipments": get_shipments_snapshot()}


@router.get("/map", dependencies=[Depends(require_roles(UserRole.admin, UserRole.transporter, UserRole.dealer, UserRole.retail_shop))])
def get_map_data() -> dict:
    snapshot = get_shipments_snapshot()
    points = [{"shipment_id": shipment_id, **data} for shipment_id, data in snapshot.items()]
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
    return build_tracking_analytics_snapshot(get_shipments_snapshot(), time_range=time_range)
