from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import run  # noqa: E402


@dataclass(frozen=True)
class Principal:
    email: str
    password: str
    role: str


def _login(client: TestClient, principal: Principal) -> str:
    resp = client.post(
        "/api/auth/login",
        json={
            "email": principal.email,
            "password": principal.password,
            "role": principal.role,
        },
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Login failed for {principal.email} ({principal.role}): {resp.status_code} {resp.text}")
    return resp.json()["access_token"]


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _check(status_ok: bool, label: str, *, status_code: int, details: str = "") -> bool:
    prefix = "OK " if status_ok else "BAD"
    extra = f" - {details}" if details else ""
    print(f"{prefix} {label}: {status_code}{extra}")
    return status_ok


def _safe_json(resp) -> str:
    try:
        payload = resp.json()
    except Exception:
        return ""
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=True)[:220]


def main() -> int:
    client = TestClient(run.app)

    principals = {
        "admin": Principal("admin@globalsupply.com", "admin123", "admin"),
        "manufacturer": Principal("manufacturer@globalsupply.com", "maker123", "manufacturer"),
        "transporter": Principal("transporter@globalsupply.com", "transport123", "transporter"),
        "dealer": Principal("dealer@globalsupply.com", "dealer123", "dealer"),
        "retail": Principal("retail@globalsupply.com", "retail123", "retail_shop"),
    }

    tokens: dict[str, str] = {}
    for key, principal in principals.items():
        tokens[key] = _login(client, principal)

    ok = True

    # Health is public.
    health = client.get("/health")
    ok &= _check(health.status_code == 200, "GET /health", status_code=health.status_code, details=_safe_json(health))

    # Admin services.
    admin_h = _auth_headers(tokens["admin"])
    stats = client.get("/api/admin/stats", headers=admin_h)
    ok &= _check(stats.status_code == 200, "GET /api/admin/stats", status_code=stats.status_code, details=_safe_json(stats))

    forecast = client.get(
        "/api/admin/ai-forecast",
        headers=admin_h,
        params={"history": "120,128,134,140,155,162", "horizon": 4},
    )
    ok &= _check(
        forecast.status_code == 200,
        "GET /api/admin/ai-forecast",
        status_code=forecast.status_code,
        details=_safe_json(forecast),
    )

    analytics = client.get("/api/admin/analytics", headers=admin_h, params={"range": "30d"})
    ok &= _check(
        analytics.status_code == 200,
        "GET /api/admin/analytics",
        status_code=analytics.status_code,
        details=_safe_json(analytics),
    )

    txns = client.get("/api/admin/blockchain/transactions", headers=admin_h)
    ok &= _check(
        txns.status_code == 200,
        "GET /api/admin/blockchain/transactions",
        status_code=txns.status_code,
        details=_safe_json(txns),
    )

    # Manufacturer services.
    manuf_h = _auth_headers(tokens["manufacturer"])
    manuf_products = client.get("/api/manufacturer/products", headers=manuf_h)
    ok &= _check(
        manuf_products.status_code == 200,
        "GET /api/manufacturer/products",
        status_code=manuf_products.status_code,
        details=_safe_json(manuf_products),
    )
    manuf_batches = client.get("/api/manufacturer/batches", headers=manuf_h)
    ok &= _check(
        manuf_batches.status_code == 200,
        "GET /api/manufacturer/batches",
        status_code=manuf_batches.status_code,
        details=_safe_json(manuf_batches),
    )
    manuf_forecast = client.get(
        "/api/manufacturer/ai-forecast",
        headers=manuf_h,
        params={"history": "24,28,26,31,35,33", "horizon": 3},
    )
    ok &= _check(
        manuf_forecast.status_code == 200,
        "GET /api/manufacturer/ai-forecast",
        status_code=manuf_forecast.status_code,
        details=_safe_json(manuf_forecast),
    )

    # Dealer services.
    dealer_h = _auth_headers(tokens["dealer"])
    pipeline = client.get("/api/dealer/orders/pipeline", headers=dealer_h)
    ok &= _check(
        pipeline.status_code == 200,
        "GET /api/dealer/orders/pipeline",
        status_code=pipeline.status_code,
        details=_safe_json(pipeline),
    )
    dealer_inventory = client.get("/api/dealer/inventory", headers=dealer_h)
    ok &= _check(
        dealer_inventory.status_code == 200,
        "GET /api/dealer/inventory",
        status_code=dealer_inventory.status_code,
        details=_safe_json(dealer_inventory),
    )
    reorder = client.get("/api/dealer/reorder-recommendations", headers=dealer_h, params={"days": 30})
    ok &= _check(
        reorder.status_code == 200,
        "GET /api/dealer/reorder-recommendations",
        status_code=reorder.status_code,
        details=_safe_json(reorder),
    )

    # Inventory services (shared).
    inv = client.get("/api/inventory", headers=dealer_h)
    ok &= _check(inv.status_code == 200, "GET /api/inventory", status_code=inv.status_code, details=_safe_json(inv))
    inv_sales = client.get("/api/inventory/sales-analytics", headers=dealer_h, params={"range": "week"})
    ok &= _check(
        inv_sales.status_code == 200,
        "GET /api/inventory/sales-analytics",
        status_code=inv_sales.status_code,
        details=_safe_json(inv_sales),
    )

    # Tracking services.
    tracking_h = _auth_headers(tokens["transporter"])
    gps = client.get("/api/tracking/live-gps", headers=tracking_h)
    ok &= _check(gps.status_code == 200, "GET /api/tracking/live-gps", status_code=gps.status_code, details=_safe_json(gps))
    map_data = client.get("/api/tracking/map", headers=tracking_h)
    ok &= _check(map_data.status_code == 200, "GET /api/tracking/map", status_code=map_data.status_code, details=_safe_json(map_data))
    delay = client.post(
        "/api/tracking/ai-delay-risk",
        headers=tracking_h,
        json={"distance_km": 420, "weather_score": 0.35, "traffic_score": 0.55},
    )
    ok &= _check(
        delay.status_code == 200,
        "POST /api/tracking/ai-delay-risk",
        status_code=delay.status_code,
        details=_safe_json(delay),
    )

    # Blockchain services (needs an allowed role).
    chain = client.get("/api/blockchain/journey-summary/N95-KIT", headers=admin_h)
    ok &= _check(
        chain.status_code == 200,
        "GET /api/blockchain/journey-summary/N95-KIT",
        status_code=chain.status_code,
        details=_safe_json(chain),
    )
    qr = client.get("/api/blockchain/qr/N95-KIT", headers=admin_h)
    ok &= _check(
        qr.status_code == 200,
        "GET /api/blockchain/qr/N95-KIT",
        status_code=qr.status_code,
        details=_safe_json(qr),
    )

    # WebSockets.
    with client.websocket_connect("/ws/notifications/admin") as ws:
        init_msg = ws.receive_json()
        ok &= _check(
            init_msg.get("type") == "notification:init",
            "WS /ws/notifications/admin",
            status_code=101,
            details=str(init_msg.get("type")),
        )
        ws.send_text("ping")

    with client.websocket_connect("/ws/gps") as ws:
        message = ws.receive_text()
        ok &= _check(
            message.startswith("{") and "shipments" in message,
            "WS /ws/gps",
            status_code=101,
            details=message[:120],
        )

    print("RESULT:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
