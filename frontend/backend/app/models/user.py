from __future__ import annotations

from enum import Enum
from typing import List

from pydantic import BaseModel


class UserRole(str, Enum):
    admin = "admin"
    manufacturer = "manufacturer"
    transporter = "transporter"
    dealer = "dealer"
    retail_shop = "retail_shop"


class User(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole


class UserPermission(BaseModel):
    role: UserRole
    permissions: List[str]
