import pytest

from fastapi import HTTPException

from app.core.middleware import require_roles
from app.models.user import UserRole


def test_require_roles_allows_admin_override() -> None:
    dependency = require_roles(UserRole.manufacturer)
    assert dependency({"role": "admin"}) == {"role": "admin"}


def test_require_roles_denies_other_roles() -> None:
    dependency = require_roles(UserRole.manufacturer)
    with pytest.raises(HTTPException) as excinfo:
        dependency({"role": "dealer"})
    assert excinfo.value.status_code == 403
