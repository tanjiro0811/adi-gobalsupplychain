from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.middleware import require_roles
from app.models.user import UserRole
from app.services.blockchain_service import generate_product_hash, verify_product_hash
from app.services.state_service import ledger_records

router = APIRouter(prefix="/blockchain", tags=["blockchain"])


class HashRequest(BaseModel):
    product_id: str
    batch_id: str
    payload: dict = Field(default_factory=dict)


class VerifyRequest(BaseModel):
    product_id: str
    batch_id: str
    payload: dict = Field(default_factory=dict)
    ledger_hash: str


@router.post("/hash", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer))])
def create_hash(data: HashRequest) -> dict:
    digest = generate_product_hash(
        product_id=data.product_id,
        batch_id=data.batch_id,
        payload=data.payload,
    )
    key = f"{data.product_id}:{data.batch_id}"
    ledger_records[key] = {
        "product_id": data.product_id,
        "batch_id": data.batch_id,
        "payload": data.payload,
        "ledger_hash": digest,
    }
    return {"product_id": data.product_id, "batch_id": data.batch_id, "ledger_hash": digest}


@router.post("/verify", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer, UserRole.retail_shop))])
def verify_hash(data: VerifyRequest) -> dict:
    is_valid = verify_product_hash(
        product_id=data.product_id,
        batch_id=data.batch_id,
        payload=data.payload,
        ledger_hash=data.ledger_hash,
    )
    return {"valid": is_valid}


@router.get("/record/{product_id}/{batch_id}", dependencies=[Depends(require_roles(UserRole.admin, UserRole.manufacturer, UserRole.dealer, UserRole.retail_shop))])
def get_ledger_record(product_id: str, batch_id: str) -> dict:
    key = f"{product_id}:{batch_id}"
    record = ledger_records.get(key)
    if record is None:
        raise HTTPException(status_code=404, detail="Ledger record not found")
    return record
