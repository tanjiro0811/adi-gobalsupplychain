from __future__ import annotations

import io
import json
import base64
from typing import Any, Optional, cast
from urllib.parse import quote

import qrcode  # type: ignore[import-untyped]
from qrcode import constants as qrcode_constants  # type: ignore[import-untyped]
from qrcode.exceptions import DataOverflowError  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.middleware import require_roles
from app.models.user import UserRole
from app.services.blockchain_service import generate_product_hash, generate_tx_hash, verify_product_hash
from app.services.database_service import (
    DatabaseError,
    create_ledger_record,
    get_ledger_record,
    get_ledger_record_by_tx_hash,
    get_product_journey,
)
from app.services.ai_service import summarize_product_journey

router = APIRouter(prefix="/blockchain", tags=["blockchain"])


class HashRequest(BaseModel):
    product_id: str
    batch_id: str
    payload: dict = Field(default_factory=dict)
    event_stage: str = "manual_registration"


class VerifyRequest(BaseModel):
    product_id: str
    batch_id: str
    payload: dict = Field(default_factory=dict)
    ledger_hash: str
    tx_hash: Optional[str] = None


@router.post("/hash", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer))])
def create_hash(data: HashRequest) -> dict:
    digest = generate_product_hash(
        product_id=data.product_id,
        batch_id=data.batch_id,
        payload=data.payload,
    )
    tx_hash = generate_tx_hash(
        {
            "productId": data.product_id,
            "batchId": data.batch_id,
            "eventStage": data.event_stage,
            "payload": data.payload,
        }
    )
    try:
        record = create_ledger_record(
            product_id=data.product_id,
            batch_id=data.batch_id,
            event_stage=data.event_stage,
            payload=data.payload,
            ledger_hash=digest,
            tx_hash=tx_hash,
        )
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc

    return {
        "product_id": data.product_id,
        "batch_id": data.batch_id,
        "event_stage": data.event_stage,
        "ledger_hash": digest,
        "txHash": tx_hash,
        "record": record,
    }


@router.post("/verify", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer, UserRole.retail_shop))])
def verify_hash(data: VerifyRequest) -> dict:
    is_valid = verify_product_hash(
        product_id=data.product_id,
        batch_id=data.batch_id,
        payload=data.payload,
        ledger_hash=data.ledger_hash,
    )
    tx_exists = False
    if data.tx_hash:
        tx_exists = get_ledger_record_by_tx_hash(data.tx_hash) is not None
    return {"valid": is_valid, "txHashFound": tx_exists}


@router.get("/record/{product_id}/{batch_id}", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer, UserRole.retail_shop))])
def get_ledger(product_id: str, batch_id: str) -> dict:
    record = get_ledger_record(product_id=product_id, batch_id=batch_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Ledger record not found")
    return record


@router.get("/journey/{product_sku}", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer, UserRole.retail_shop))])
def product_journey(product_sku: str) -> dict:
    try:
        journey = get_product_journey(product_sku=product_sku)
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc
    return {"productSku": product_sku, "journey": journey}


@router.get("/journey-summary/{product_sku}", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer, UserRole.retail_shop))])
def product_journey_summary(product_sku: str) -> dict:
    try:
        journey = get_product_journey(product_sku=product_sku)
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc

    summary = summarize_product_journey(journey)
    return {"productSku": product_sku, "journey": journey, "summary": summary}


@router.get("/qr/{product_sku}", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer, UserRole.retail_shop))])
def product_qr(product_sku: str, request: Request) -> dict:
    try:
        journey = get_product_journey(product_sku=product_sku)
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc

    qr_payload = {
        "productSku": product_sku,
        "journey": journey,
    }

    base_url = str(request.base_url).rstrip("/")
    journey_path = f"/api/blockchain/journey-summary/{quote(product_sku)}"
    journey_url = f"{base_url}{journey_path}"
    if len(journey_url) > 500:
        journey_url = journey_path
    qr_payload["journeyUrl"] = journey_url
    qr_data = journey_url

    def _render_qr(data: str) -> str:
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode_constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(data)
        try:
            qr.make(fit=True)
        except ValueError as exc:
            # qrcode can raise ValueError("Invalid version (was 41, expected 1 to 40)")
            # for payloads that don't fit. Treat as overflow so we can try smaller candidates.
            message = str(exc)
            if "expected 1 to 40" in message or message.lower().startswith("invalid version"):
                raise DataOverflowError(message) from exc
            raise
        img = qr.make_image(fill_color="black", back_color="white")

        buf = io.BytesIO()
        cast(Any, img).save(buf, format="PNG")
        b64_img = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64_img}"

    qr_image_url: str | None = None
    for candidate in (
        qr_data,
        json.dumps({"productSku": product_sku}, separators=(",", ":")),
        product_sku,
    ):
        try:
            qr_image_url = _render_qr(candidate)
            qr_data = candidate
            break
        except (ValueError, DataOverflowError):
            continue

    if qr_image_url is None:
        raise HTTPException(status_code=422, detail="QR payload is too large to encode")
    
    return {
        "productSku": product_sku,
        "qrPayload": qr_payload,
        "qrData": qr_data,
        "qrImageUrl": qr_image_url,
    }
