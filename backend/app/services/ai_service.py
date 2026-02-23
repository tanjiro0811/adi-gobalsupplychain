from __future__ import annotations

from statistics import mean


def predict_demand(history: list[float], horizon: int = 3) -> list[float]:
    """Simple moving-average baseline for demand forecasting."""
    if not history:
        return []

    baseline = mean(history[-3:]) if len(history) >= 3 else mean(history)
    return [round(baseline * (1 + i * 0.03), 2) for i in range(1, horizon + 1)]


def predict_delay_risk(distance_km: float, weather_score: float, traffic_score: float) -> float:
    """Returns a normalized delay probability in range [0, 1]."""
    raw = (distance_km / 1200) * 0.4 + weather_score * 0.3 + traffic_score * 0.3
    return round(max(0.0, min(1.0, raw)), 3)
