from __future__ import annotations

import json
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
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


@router.get("/qr/{product_sku}", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer, UserRole.retail_shop))])
def product_qr(product_sku: str) -> dict:
    try:
        journey = get_product_journey(product_sku=product_sku)
    except DatabaseError as exc:
        raise HTTPException(status_code=503, detail="Database temporarily unavailable") from exc

    qr_payload = {
        "productSku": product_sku,
        "journey": journey,
    }
    encoded = quote(json.dumps(qr_payload, separators=(",", ":"), ensure_ascii=True))
    # Image URL generated from encoded payload; frontend can render directly.
    qr_image_url = f"https://api.qrserver.com/v1/create-qr-code/?size=260x260&data={encoded}"
    return {
        "productSku": product_sku,
        "qrPayload": qr_payload,
        "qrImageUrl": qr_image_url,
    }
