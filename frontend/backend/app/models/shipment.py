from __future__ import annotations

from pydantic import BaseModel


class GPSCoordinate(BaseModel):
    lat: float
    lng: float


class Shipment(BaseModel):
    id: int
    tracking_id: str
    product_id: int
    current_location: GPSCoordinate
    status: str
