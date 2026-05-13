from __future__ import annotations

products: list[dict] = [
    {"id": 1, "sku": "N95-KIT", "name": "N95 Safety Kit", "quantity": 1200, "price": 42.5},
    {"id": 2, "sku": "IV-SET", "name": "IV Set", "quantity": 760, "price": 15.0},
]

batches: list[dict] = []

shipments: dict[str, dict] = {
    "SHP-1001": {
        "lat": 18.5204,
        "lng": 73.8567,
        "status": "in_transit",
        "origin": "Mumbai, MH",
        "destination": "Bengaluru, KA",
        "eta": "2026-02-19 18:30",
        "weight": 1260,
        "vehicleNumber": "MH12AB4321",
        "assignmentStatus": "Assigned",
        "deliveryPartner": {
            "name": "SwiftMove Logistics",
            "phone": "+91 90000 12001",
            "rating": 4.7,
            "logo": "",
        },
        "feedback": {
            "rating": 4.8,
            "comment": "Route clear, shipment on schedule.",
        },
        "timestamp": "2026-02-18T10:42:00Z",
    },
    "SHP-1002": {
        "lat": 28.6139,
        "lng": 77.2090,
        "status": "delayed",
        "origin": "Delhi, DL",
        "destination": "Jaipur, RJ",
        "eta": "2026-02-19 21:15",
        "weight": 980,
        "vehicleNumber": "DL05CD7788",
        "assignmentStatus": "Assigned",
        "deliveryPartner": {
            "name": "PrimeRoute Carriers",
            "phone": "+91 90000 12002",
            "rating": 4.5,
            "logo": "",
        },
        "feedback": {
            "rating": 3.9,
            "comment": "Traffic slowdown reported near Gurgaon.",
        },
        "timestamp": "2026-02-18T10:39:00Z",
    },
}

ledger_records: dict[str, dict] = {}
