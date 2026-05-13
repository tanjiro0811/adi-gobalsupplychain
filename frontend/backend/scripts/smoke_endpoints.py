from __future__ import annotations

import sys
from dataclasses import dataclass
from uuid import uuid4

from fastapi.testclient import TestClient


@dataclass(frozen=True)
class Actor:
    email: str
    password: str
    role: str
    token: str


def _login(client: TestClient, *, email: str, password: str, role: str) -> str:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password, "role": role},
    )
    if response.status_code != 200:
        raise RuntimeError(f"Login failed ({role}): {response.status_code} {response.text}")
    payload = response.json()
    token = str(payload.get("access_token") or "").strip()
    if not token:
        raise RuntimeError(f"Login response missing access_token for role {role}")
    return token


def _request(client: TestClient, actor: Actor | None, method: str, url: str, **kwargs):
    headers = dict(kwargs.pop("headers", {}) or {})
    if actor is not None:
        headers["Authorization"] = f"Bearer {actor.token}"
    return client.request(method, url, headers=headers, **kwargs)


def _expect_ok(response, label: str) -> None:
    if 200 <= response.status_code < 300:
        return
    raise RuntimeError(f"{label}: {response.status_code} {response.text}")


def main() -> int:
    repo_root = __file__
    # Ensure `backend/` is on sys.path so `import run` works when executed from repo root.
    sys.path.insert(0, str((__import__("pathlib").Path(repo_root).resolve().parents[1])))
    import run  # noqa: E402

    client = TestClient(run.app)

    admin = Actor(
        email="admin@globalsupply.com",
        password="admin123",
        role="admin",
        token=_login(client, email="admin@globalsupply.com", password="admin123", role="admin"),
    )
    manufacturer = Actor(
        email="manufacturer@globalsupply.com",
        password="maker123",
        role="manufacturer",
        token=_login(client, email="manufacturer@globalsupply.com", password="maker123", role="manufacturer"),
    )
    transporter = Actor(
        email="transporter@globalsupply.com",
        password="transport123",
        role="transporter",
        token=_login(client, email="transporter@globalsupply.com", password="transport123", role="transporter"),
    )
    dealer = Actor(
        email="dealer@globalsupply.com",
        password="dealer123",
        role="dealer",
        token=_login(client, email="dealer@globalsupply.com", password="dealer123", role="dealer"),
    )
    retail = Actor(
        email="retail@globalsupply.com",
        password="retail123",
        role="retail_shop",
        token=_login(client, email="retail@globalsupply.com", password="retail123", role="retail_shop"),
    )

    # Basic health.
    _expect_ok(_request(client, None, "GET", "/health"), "GET /health")
    _expect_ok(_request(client, admin, "GET", "/api/auth/validate-token"), "GET /api/auth/validate-token")

    # Admin dashboard endpoints (subset).
    _expect_ok(_request(client, admin, "GET", "/api/admin/stats"), "GET /api/admin/stats")
    _expect_ok(_request(client, admin, "GET", "/api/admin/analytics?range=30d"), "GET /api/admin/analytics")
    _expect_ok(
        _request(client, admin, "POST", "/api/admin/blockchain/verify", json={"txHash": "NOPE"}),
        "POST /api/admin/blockchain/verify",
    )

    # Dealer -> Manufacturer -> Transporter -> Dealer -> Retail -> Sale flow.
    order_response = _request(
        client,
        dealer,
        "POST",
        "/api/dealer/orders/retail",
        json={
            "retailer_name": "Smoke Retail",
            "retailer_email": f"smoke-{uuid4().hex[:8]}@example.com",
            "product_sku": "N95-KIT",
            "quantity": 5,
            "origin": "Test Origin",
            "destination": "Test Destination",
        },
    )
    _expect_ok(order_response, "POST /api/dealer/orders/retail")
    order_code = str((order_response.json() or {}).get("order", {}).get("order_code") or "").strip()
    if not order_code:
        raise RuntimeError("POST /api/dealer/orders/retail: response missing order.order_code")

    _expect_ok(
        _request(client, dealer, "PATCH", f"/api/dealer/orders/{order_code}/confirm", json={}),
        "PATCH /api/dealer/orders/{order_code}/confirm",
    )
    _expect_ok(
        _request(
            client,
            dealer,
            "PATCH",
            f"/api/dealer/orders/{order_code}/dealer-order",
            json={"manufacturer_id": "manufacturer"},
        ),
        "PATCH /api/dealer/orders/{order_code}/dealer-order",
    )
    _expect_ok(
        _request(
            client,
            manufacturer,
            "PATCH",
            f"/api/manufacturer/orders/{order_code}/create-batch",
            json={"product_sku": "N95-KIT", "quantity": 5},
        ),
        "PATCH /api/manufacturer/orders/{order_code}/create-batch",
    )

    shipment_id = f"SHP-{uuid4().hex[:6].upper()}"
    _expect_ok(
        _request(
            client,
            manufacturer,
            "PATCH",
            f"/api/manufacturer/orders/{order_code}/assign-transporter",
            json={
                "transporter_id": "transporter",
                "shipment_id": shipment_id,
                "origin": "Test Origin",
                "destination": "Test Destination",
                "eta": "2026-03-24T00:00:00Z",
                "vehicle_number": "MH-01-TEST",
                "lat": 19.0760,
                "lng": 72.8777,
            },
        ),
        "PATCH /api/manufacturer/orders/{order_code}/assign-transporter",
    )
    _expect_ok(
        _request(
            client,
            transporter,
            "PATCH",
            f"/api/tracking/shipments/{shipment_id}",
            json={"lat": 19.1, "lng": 72.9, "status": "in_transit"},
        ),
        "PATCH /api/tracking/shipments/{shipment_id}",
    )
    _expect_ok(
        _request(
            client,
            transporter,
            "PATCH",
            f"/api/tracking/orders/{order_code}/stage",
            json={"stage": "dealer_received", "shipment_id": shipment_id, "lat": 19.2, "lng": 73.0},
        ),
        "PATCH /api/tracking/orders/{order_code}/stage",
    )
    _expect_ok(
        _request(client, dealer, "PATCH", f"/api/dealer/orders/{order_code}/receive", json={}),
        "PATCH /api/dealer/orders/{order_code}/receive",
    )
    _expect_ok(
        _request(client, retail, "PATCH", f"/api/dealer/orders/{order_code}/retail-receive", json={}),
        "PATCH /api/dealer/orders/{order_code}/retail-receive",
    )
    _expect_ok(
        _request(
            client,
            retail,
            "POST",
            "/api/inventory/sales",
            json={
                "sku": "N95-KIT",
                "quantity": 1,
                "retailer_name": "Smoke Retail",
                "payment_method": "cash",
                "order_code": order_code,
            },
        ),
        "POST /api/inventory/sales",
    )

    qr_response = _request(client, admin, "GET", "/api/blockchain/qr/N95-KIT")
    _expect_ok(qr_response, "GET /api/blockchain/qr/N95-KIT")
    payload = qr_response.json() or {}
    if not str(payload.get("qrImageUrl") or "").startswith("data:image/png;base64,"):
        raise RuntimeError("GET /api/blockchain/qr/N95-KIT: response missing qrImageUrl data URI")

    # Websocket endpoints should publish something quickly.
    with client.websocket_connect("/ws/gps") as websocket:
        websocket.receive_text()

    with client.websocket_connect("/ws/notifications/admin") as websocket:
        websocket.receive_json()

    print("[smoke] OK: core API + websocket flow passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
