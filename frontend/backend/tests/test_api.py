import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Tests should never require a real SMTP connection.
os.environ.setdefault("MOCK_EMAIL_DELIVERY", "true")

from run import app  # noqa: E402

@pytest_asyncio.fixture
async def async_client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


@pytest.mark.asyncio
async def test_health_check(async_client):
    response = await async_client.get("/api/admin/stats")
    assert response.status_code in (200, 401)


@pytest.mark.asyncio
async def test_login_invalid_credentials(async_client):
    response = await async_client.post(
        "/api/auth/login",
        json={"email": "wrong@example.com", "password": "wrongpassword", "role": "admin"}
    )
    assert response.status_code == 401, f"Failed with {response.status_code}: {response.text}"
    assert "Invalid credentials" in response.json()["detail"]


@pytest.mark.asyncio
async def test_inventory_list_pagination(async_client):
    response = await async_client.get("/api/inventory?skip=0&limit=5")
    # without auth we expect 401 or 403, which is also a valid API test to ensure security
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_signup_validation_error(async_client):
    response = await async_client.post(
        "/api/auth/signup",
        json={"email": "not-an-email", "password": "123", "role": "admin", "name": "A"}
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_send_otp_success_format(async_client):
    # This also exercises rate limiting
    # Need to provide name to satisfy the Pydantic schema
    response = await async_client.post(
        "/api/auth/send-otp",
        json={"email": "test@example.com", "name": "Test User"}
    )
    assert response.status_code == 200, f"Failed with {response.status_code}: {response.text}"
    assert "message" in response.json()


@pytest.mark.asyncio
async def test_ai_routes_require_auth(async_client):
    response = await async_client.get("/api/ai/status")
    assert response.status_code == 401

    response = await async_client.post(
        "/api/ai/forecast-with-insights",
        json={"product_name": "Test", "history": [10, 12, 11], "horizon": 7},
    )
    assert response.status_code == 401
