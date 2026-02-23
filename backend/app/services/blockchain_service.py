from __future__ import annotations

import hashlib
import json

from app.core.config import get_settings


def _canonical_payload(payload: dict) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def generate_product_hash(product_id: str, batch_id: str, payload: dict) -> str:
    settings = get_settings()
    normalized = f"{product_id}|{batch_id}|{_canonical_payload(payload)}|{settings.blockchain_salt}"
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def verify_product_hash(product_id: str, batch_id: str, payload: dict, ledger_hash: str) -> bool:
    expected = generate_product_hash(product_id=product_id, batch_id=batch_id, payload=payload)
    return expected == ledger_hash
