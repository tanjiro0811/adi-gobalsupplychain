from __future__ import annotations

import json
import re
from math import isfinite
from statistics import mean
from urllib import error as url_error
from urllib import parse as url_parse
from urllib import request as url_request

from app.core.config import get_settings

_GEMINI_MODEL = "gemini-1.5-flash"
_GEMINI_TIMEOUT_SECONDS = 2.5
_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


def _baseline_forecast(history: list[float], horizon: int) -> list[float]:
    baseline = mean(history[-3:]) if len(history) >= 3 else mean(history)
    return [round(baseline * (1 + index * 0.03), 2) for index in range(1, horizon + 1)]


def _sanitize_history(history: list[float]) -> list[float]:
    cleaned: list[float] = []
    for value in history:
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if not isfinite(number):
            continue
        cleaned.append(max(0.0, round(number, 4)))
    return cleaned


def _extract_candidate_text(payload: dict) -> str:
    candidates = payload.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        return ""
    content = candidates[0].get("content") if isinstance(candidates[0], dict) else None
    parts = content.get("parts") if isinstance(content, dict) else None
    if not isinstance(parts, list):
        return ""
    texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    return "\n".join(chunk for chunk in texts if isinstance(chunk, str)).strip()


def _coerce_forecast(raw_forecast: list[object], horizon: int) -> list[float]:
    normalized: list[float] = []
    for item in raw_forecast:
        try:
            value = float(item)
        except (TypeError, ValueError):
            continue
        if not isfinite(value):
            continue
        normalized.append(round(max(0.0, value), 2))
    if not normalized:
        return []
    if len(normalized) < horizon:
        normalized.extend([normalized[-1]] * (horizon - len(normalized)))
    return normalized[:horizon]


def _extract_json_payload(text: str) -> dict | list | None:
    content = str(text or "").strip()
    if not content:
        return None

    attempts = [content]
    fenced = re.sub(r"^```(?:json)?\s*|\s*```$", "", content, flags=re.IGNORECASE)
    if fenced != content:
        attempts.append(fenced.strip())

    object_match = re.search(r"\{[\s\S]*\}", content)
    if object_match:
        attempts.append(object_match.group(0))

    for candidate in attempts:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return None


def _request_gemini_forecast(history: list[float], horizon: int, api_key: str) -> list[float]:
    endpoint = f"{_GEMINI_BASE_URL}/{_GEMINI_MODEL}:generateContent?{url_parse.urlencode({'key': api_key})}"
    prompt = (
        "You are a demand forecasting assistant for supply chain operations.\n"
        f"Input daily unit sales history: {history[-60:]}\n"
        f"Forecast horizon: {horizon} days.\n"
        "Return only compact JSON with this shape: "
        '{"forecast":[number,number],"summary":"one short sentence"}. '
        "The forecast array must contain exactly the requested number of positive numbers."
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "response_mime_type": "application/json",
        },
    }

    request = url_request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with url_request.urlopen(request, timeout=_GEMINI_TIMEOUT_SECONDS) as response:
            raw_body = response.read().decode("utf-8")
    except (url_error.URLError, TimeoutError, OSError):
        return []

    try:
        parsed_response = json.loads(raw_body)
    except json.JSONDecodeError:
        return []

    text = _extract_candidate_text(parsed_response)
    extracted = _extract_json_payload(text)
    if isinstance(extracted, dict):
        raw_forecast = extracted.get("forecast")
        if isinstance(raw_forecast, list):
            return _coerce_forecast(raw_forecast, horizon)
    if isinstance(extracted, list):
        return _coerce_forecast(extracted, horizon)
    return []


def predict_demand(history: list[float], horizon: int = 3) -> list[float]:
    """Predicts demand via Gemini API with safe baseline fallback."""
    if horizon <= 0:
        return []

    clean_history = _sanitize_history(history)
    if not clean_history:
        return []

    baseline = _baseline_forecast(clean_history, horizon)
    api_key = get_settings().gemini_api_key
    if not api_key:
        return baseline

    gemini_forecast = _request_gemini_forecast(clean_history, horizon, api_key)
    return gemini_forecast or baseline


def predict_delay_risk(distance_km: float, weather_score: float, traffic_score: float) -> float:
    """Returns a normalized delay probability in range [0, 1]."""
    raw = (distance_km / 1200) * 0.4 + weather_score * 0.3 + traffic_score * 0.3
    return round(max(0.0, min(1.0, raw)), 3)


def predict_low_stock(inventory_data: list[dict], api_key: str) -> list[dict]:
    """Uses Gemini to analyze inventory and sales data and predict stockouts."""
    if not api_key:
        return inventory_data

    endpoint = f"{_GEMINI_BASE_URL}/{_GEMINI_MODEL}:generateContent?{url_parse.urlencode({'key': api_key})}"
    prompt = (
        "You are an AI supply chain analyst. "
        "Review this inventory data and predict which products will run low first. "
        f"Data: {json.dumps(inventory_data)}\n"
        "Return compact JSON containing an array of objects under the key 'recommendations'. "
        "Each object must have 'sku', 'priority' ('high', 'medium', 'low'), and 'recommendation' (a short sentence explaining why). "
        "Keep the same skus. Provide an insightful AI-driven recommendation."
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "response_mime_type": "application/json",
        },
    }

    request = url_request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with url_request.urlopen(request, timeout=5.0) as response:
            raw_body = response.read().decode("utf-8")
        parsed = json.loads(raw_body)
        text = _extract_candidate_text(parsed)
        extracted = _extract_json_payload(text)
        if isinstance(extracted, dict) and "recommendations" in extracted:
            ai_recs = extracted["recommendations"]
            # Merge back with original
            merged = []
            for item in inventory_data:
                sku = item.get("sku")
                matching = next((r for r in ai_recs if r.get("sku") == sku), {})
                merged.append({
                    **item,
                    "recommendation": matching.get("recommendation", item.get("recommendation")),
                    "priority": matching.get("priority", item.get("priority"))
                })
            return merged
    except Exception:
        pass

    return inventory_data
