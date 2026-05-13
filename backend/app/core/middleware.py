from __future__ import annotations

from collections.abc import Callable
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt  # type: ignore[import-untyped]

from app.core.config import get_settings
from app.models.user import UserRole

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_payload(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token is required",
        )

    settings = get_settings()
    token = credentials.credentials

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    return payload


def require_roles(*allowed_roles: UserRole) -> Callable[[dict], dict]:
    allowed = {role.value if isinstance(role, UserRole) else str(role) for role in allowed_roles}
    # Admin can access all role-protected resources.
    allowed.add(UserRole.admin.value)

    def dependency(payload: dict = Depends(get_current_payload)) -> dict:
        role = payload.get("role")
        if role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' is not allowed for this resource",
            )
        return payload

    return dependency
