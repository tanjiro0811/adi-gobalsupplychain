from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class Product(BaseModel):
    id: int
    sku: str
    name: str
    blockchain_hash: Optional[str] = None
