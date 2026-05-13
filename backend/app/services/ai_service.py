from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import re
import threading
import time
from dataclasses import dataclass
from functools import partial
from math import isfinite
from statistics import StatisticsError, mean, stdev
from typing import Any, AsyncIterator, Iterator

import httpx

from app.core.config import get_settings

anthropic: Any
try:
    import anthropic as _anthropic_sdk

    anthropic = _anthropic_sdk
except ImportError:
    anthropic = None

APIConnectionError = getattr(anthropic, "APIConnectionError", Exception)
APIStatusError = getattr(anthropic, "APIStatusError", Exception)
RateLimitError = getattr(anthropic, "RateLimitError", Exception)

logger = logging.getLogger(__name__)

_ANTHROPIC_MODEL = "claude-opus-4-6"
_GEMINI_MODEL = "gemini-2.0-flash"
_ANTHROPIC_KEY_PREFIX = "sk-ant-"
_GEMINI_KEY_PREFIX = "AIza"
<<<<<<< HEAD
_DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
=======
_TIMEOUT = 10.0
_MAX_RETRIES = 3
_RETRY_BASE_WAIT = 1.5
_CACHE_TTL = 300.0
_CACHE_MAX_SIZE = 256
_AUTH_DISABLE_SECONDS = 600.0
>>>>>>> 2e0225834c4e9b35737288da65ee57f107aed6aa

_AUTH_LOCK = threading.Lock()
_AUTH_DISABLED_UNTIL = 0.0


@dataclass
class _CacheEntry:
    value: Any
    expires_at: float


class _LRUCache:
    def __init__(self, max_size: int, ttl: float) -> None:
        self._store: dict[str, _CacheEntry] = {}
        self._max = max_size
        self._ttl = ttl
        self._lock = threading.Lock()

    @staticmethod
    def _key(prompt: str) -> str:
        return hashlib.sha256(prompt.encode("utf-8")).hexdigest()

    def get(self, prompt: str) -> Any | None:
        key = self._key(prompt)
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            if time.monotonic() > entry.expires_at:
                del self._store[key]
                return None
            self._store[key] = self._store.pop(key)
            return entry.value

    def set(self, prompt: str, value: Any) -> None:
        key = self._key(prompt)
        with self._lock:
            if key in self._store:
                self._store.pop(key)
            elif len(self._store) >= self._max:
                self._store.pop(next(iter(self._store)))
            self._store[key] = _CacheEntry(value=value, expires_at=time.monotonic() + self._ttl)


_cache = _LRUCache(_CACHE_MAX_SIZE, _CACHE_TTL)

_PROMPTS = {
    "forecast": "Return valid JSON with forecast, confidence, trend, seasonality_detected, summary, risk_factors, recommended_safety_stock, reorder_point.",
    "supplier_risk": "Return valid JSON with overall_risk_score, risk_level, confidence, dimensions, red_flags, positive_indicators, recommendations, alternative_suppliers.",
    "route": "Return valid JSON with optimised_sequence, total_distance_km, total_duration_hours, estimated_fuel_cost_inr, co2_kg, savings, risk_factors, recommendations.",
    "inventory": "Return valid JSON with alert_level, items_at_risk, immediate_actions, weekly_actions, total_reorder_cost_inr.",
    "anomaly": "Return valid JSON with anomaly_detected, severity, confidence, anomalies, delay_hours, eta_revised, customer_message.",
    "blockchain": "Return valid JSON with summary, highlight, keyStage, steps, provenance_score, compliance_flags, journey_health.",
    "dashboard": "Return valid JSON with headline, health_score, top_priority, alerts, opportunities, weekly_summary.",
}


def _ai_disabled() -> bool:
    with _AUTH_LOCK:
        return time.monotonic() < _AUTH_DISABLED_UNTIL


def _disable_ai_for(seconds: float, *, reason: str) -> None:
    global _AUTH_DISABLED_UNTIL
    with _AUTH_LOCK:
        now = time.monotonic()
        if now < _AUTH_DISABLED_UNTIL:
            return
        _AUTH_DISABLED_UNTIL = now + float(seconds)
    logger.warning("ai_service: %s (disabled for %.0fs)", reason, float(seconds))


def _current_provider() -> str:
    provider = (getattr(get_settings(), "ai_provider", "") or "auto").strip().lower()
    return provider or "auto"


def _anthropic_api_key() -> str:
    return (getattr(get_settings(), "anthropic_api_key", "") or "").strip()


def _gemini_api_key() -> str:
    settings = get_settings()
    direct = (getattr(settings, "gemini_api_key", "") or "").strip()
    if direct:
        return direct
    fallback = _anthropic_api_key()
    return fallback if fallback.startswith(_GEMINI_KEY_PREFIX) else ""


<<<<<<< HEAD
def _current_provider() -> str:
    settings = get_settings()
    candidate = (getattr(settings, "ai_provider", "") or "auto").strip().lower()
    return candidate or "auto"


def _current_gemini_model() -> str:
    settings = get_settings()
    candidate = (getattr(settings, "gemini_model", "") or _DEFAULT_GEMINI_MODEL).strip()
    return candidate or _DEFAULT_GEMINI_MODEL


def _anthropic_api_key() -> str:
    return (getattr(get_settings(), "anthropic_api_key", "") or "").strip()


def _gemini_api_key() -> str:
    settings = get_settings()
    direct = (getattr(settings, "gemini_api_key", "") or "").strip()
    if direct:
        return direct

    # Backward compatibility: some builds stored a Gemini key in ANTHROPIC_API_KEY (starts with "AIza").
    fallback = _anthropic_api_key()
    if fallback.startswith(_GEMINI_KEY_PREFIX):
        return fallback

    return ""


def ai_configured() -> bool:
    if _ai_disabled():
        return False

    provider = _current_provider()
    if provider == "anthropic":
        return _anthropic_api_key().startswith(_ANTHROPIC_KEY_PREFIX)
    if provider == "gemini":
        return bool(_gemini_api_key())

    # auto
    if _anthropic_api_key().startswith(_ANTHROPIC_KEY_PREFIX):
        return True
    return bool(_gemini_api_key())


def ai_status() -> dict:
    provider = _current_provider()

    if provider == "anthropic":
        enabled = _anthropic_api_key().startswith(_ANTHROPIC_KEY_PREFIX) and not _ai_disabled()
        return {"enabled": enabled, "provider": "anthropic", "model": _current_model()}
    if provider == "gemini":
        enabled = bool(_gemini_api_key()) and not _ai_disabled()
        return {"enabled": enabled, "provider": "gemini", "model": _current_gemini_model()}

    if _anthropic_api_key().startswith(_ANTHROPIC_KEY_PREFIX) and not _ai_disabled():
        return {"enabled": True, "provider": "anthropic", "model": _current_model()}
    if _gemini_api_key() and not _ai_disabled():
        return {"enabled": True, "provider": "gemini", "model": _current_gemini_model()}

    return {"enabled": False, "provider": "none", "model": ""}


# ── LRU Response Cache ────────────────────────────────────────────────────────

@dataclass
class _CacheEntry:
    value: Any
    expires_at: float
=======
def _current_model() -> str:
    model = (getattr(get_settings(), "anthropic_model", "") or _ANTHROPIC_MODEL).strip()
    return model or _ANTHROPIC_MODEL
>>>>>>> 2e0225834c4e9b35737288da65ee57f107aed6aa


def _current_gemini_model() -> str:
    model = (getattr(get_settings(), "gemini_model", "") or _GEMINI_MODEL).strip()
    return model or _GEMINI_MODEL


def _anthropic_ready() -> bool:
    return anthropic is not None and _anthropic_api_key().startswith(_ANTHROPIC_KEY_PREFIX)


def _gemini_ready() -> bool:
    return bool(_gemini_api_key())


def ai_configured() -> bool:
    if _ai_disabled():
        return False
    provider = _current_provider()
    if provider == "anthropic":
        return _anthropic_ready()
    if provider == "gemini":
        return _gemini_ready()
    return _anthropic_ready() or _gemini_ready()


<<<<<<< HEAD
    key = _anthropic_api_key()
    if not key:
        return None
=======
def ai_status() -> dict:
    if _ai_disabled():
        return {"enabled": False, "provider": "none", "model": ""}
    provider = _current_provider()
    if provider == "anthropic":
        return {"enabled": _anthropic_ready(), "provider": "anthropic", "model": _current_model()}
    if provider == "gemini":
        return {"enabled": _gemini_ready(), "provider": "gemini", "model": _current_gemini_model()}
    if _anthropic_ready():
        return {"enabled": True, "provider": "anthropic", "model": _current_model()}
    if _gemini_ready():
        return {"enabled": True, "provider": "gemini", "model": _current_gemini_model()}
    return {"enabled": False, "provider": "none", "model": ""}
>>>>>>> 2e0225834c4e9b35737288da65ee57f107aed6aa


async def _to_thread(func, /, *args, **kwargs):
    native = getattr(asyncio, "to_thread", None)
    if native is not None:
        return await native(func, *args, **kwargs)
    loop = asyncio.get_running_loop()
    if kwargs:
        return await loop.run_in_executor(None, partial(func, *args, **kwargs))
    return await loop.run_in_executor(None, func, *args)


def _get_client(api_key: str | None = None):
    key = str(api_key or _anthropic_api_key()).strip()
    if anthropic is None or not key.startswith(_ANTHROPIC_KEY_PREFIX):
        return None
    try:
        return anthropic.Anthropic(api_key=key, timeout=_TIMEOUT)
    except TypeError:
        return anthropic.Anthropic(api_key=key)


def _call_gemini(
    system: str,
    user: str,
    *,
<<<<<<< HEAD
    max_tokens: int,
) -> str:
    key = _gemini_api_key()
    if not key:
        return ""

    model = _current_gemini_model()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "systemInstruction": {"parts": [{"text": system}]} if system.strip() else {"parts": []},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "maxOutputTokens": int(max_tokens),
            "temperature": 0.2,
        },
    }
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
    }

    with httpx.Client(timeout=_TIMEOUT) as client:
        response = client.post(url, headers=headers, json=payload)
        if response.status_code in (401, 403):
            _disable_ai_for(
                _AUTH_DISABLE_SECONDS,
                reason=f"AI auth failed (HTTP {response.status_code}). Check GEMINI_API_KEY",
            )
            return ""
        response.raise_for_status()
        data = response.json()

    candidates = data.get("candidates") if isinstance(data, dict) else None
    if not isinstance(candidates, list) or not candidates:
        return ""

    content = candidates[0].get("content") if isinstance(candidates[0], dict) else None
    parts = content.get("parts") if isinstance(content, dict) else None
    if not isinstance(parts, list):
        return ""

    texts: list[str] = []
    for part in parts:
        if isinstance(part, dict) and isinstance(part.get("text"), str) and part["text"].strip():
            texts.append(part["text"].strip())
    return "\n".join(texts).strip()
=======
    max_tokens: int = 1024,
    api_key: str | None = None,
    model: str | None = None,
) -> str:
    gemini_key = str(api_key or _gemini_api_key()).strip()
    if not gemini_key:
        return ""
    model_name = str(model or _current_gemini_model()).strip() or _current_gemini_model()
    payload = {
        "contents": [{"role": "user", "parts": [{"text": f"System:\n{system}\n\nUser:\n{user}"}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": int(max_tokens)},
    }
    response = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent",
        params={"key": gemini_key},
        json=payload,
        timeout=_TIMEOUT,
    )
    response.raise_for_status()
    data = response.json() if response.content else {}
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    content = candidates[0].get("content") or {}
    parts = content.get("parts") or []
    texts = [str(part.get("text", "")).strip() for part in parts if isinstance(part, dict)]
    return "\n".join(chunk for chunk in texts if chunk)


def _extract_text(message: Any) -> str:
    content = getattr(message, "content", None)
    if not isinstance(content, list):
        return ""
    chunks: list[str] = []
    for block in content:
        text = getattr(block, "text", "")
        if isinstance(text, str) and text.strip():
            chunks.append(text.strip())
    return "\n".join(chunks)
>>>>>>> 2e0225834c4e9b35737288da65ee57f107aed6aa


def _call(
    system: str,
    user: str,
    *,
    max_tokens: int = 1024,
    use_cache: bool = True,
    provider_override: str | None = None,
    anthropic_api_key: str | None = None,
    gemini_api_key: str | None = None,
) -> str:
<<<<<<< HEAD
    """Call an LLM provider with retry + exponential back-off + LRU cache."""
    if _ai_disabled():
        return ""

    provider = _current_provider()
    if provider not in {"auto", "anthropic", "gemini"}:
        provider = "auto"
=======
    if _ai_disabled():
        return ""

    provider = str(provider_override or _current_provider()).strip().lower()
    anthropic_key = str(anthropic_api_key or _anthropic_api_key()).strip()
    gemini_key = str(gemini_api_key or _gemini_api_key()).strip()
    anthropic_ready = anthropic is not None and anthropic_key.startswith(_ANTHROPIC_KEY_PREFIX)
    gemini_ready = bool(gemini_key)
>>>>>>> 2e0225834c4e9b35737288da65ee57f107aed6aa

    if provider == "anthropic":
        chosen = "anthropic"
    elif provider == "gemini":
        chosen = "gemini"
    else:
<<<<<<< HEAD
        chosen = "anthropic" if _anthropic_api_key().startswith(_ANTHROPIC_KEY_PREFIX) else "gemini"

    if chosen == "anthropic":
        client = _get_client()
        if client is None:
            return ""
        model = _current_model()
    else:
        if not _gemini_api_key():
            return ""
        client = None
        model = _current_gemini_model()

    cache_key = chosen + "|||" + model + "|||" + system + "|||" + user
=======
        chosen = "anthropic" if anthropic_ready else "gemini"

    if chosen == "anthropic":
        anthropic_client = _get_client(anthropic_key)
        if anthropic_client is None:
            return ""
        model = _current_model()
    else:
        if not gemini_ready:
            return ""
        model = _current_gemini_model()

    credential_mode = "override" if provider_override or anthropic_api_key or gemini_api_key else "settings"
    cache_key = f"{chosen}|||{model}|||{credential_mode}|||{system}|||{user}"
>>>>>>> 2e0225834c4e9b35737288da65ee57f107aed6aa
    if use_cache:
        cached = _cache.get(cache_key)
        if cached is not None:
            logger.debug("ai_service: cache hit")
            return cached

    for attempt in range(_MAX_RETRIES):
        try:
            if chosen == "anthropic":
<<<<<<< HEAD
                msg = client.messages.create(
=======
                anthropic_client = _get_client(anthropic_key)
                if anthropic_client is None:
                    return ""
                response = anthropic_client.messages.create(
>>>>>>> 2e0225834c4e9b35737288da65ee57f107aed6aa
                    model=model,
                    max_tokens=max_tokens,
                    system=system,
                    messages=[{"role": "user", "content": user}],
                )
<<<<<<< HEAD
                text = _extract_text(msg)
            else:
                text = _call_gemini(system, user, max_tokens=max_tokens)
=======
                text = _extract_text(response)
            else:
                text = _call_gemini(system, user, max_tokens=max_tokens, api_key=gemini_key, model=model)
>>>>>>> 2e0225834c4e9b35737288da65ee57f107aed6aa
            if use_cache and text:
                _cache.set(cache_key, text)
            return text
        except RateLimitError:
            wait = _RETRY_BASE_WAIT * (2 ** attempt)
            logger.warning("ai_service: rate limited - waiting %.1fs (attempt %d)", wait, attempt + 1)
            time.sleep(wait)
        except APIStatusError as exc:
            status_code = int(getattr(exc, "status_code", 0) or 0)
            if status_code in (401, 403):
                _disable_ai_for(_AUTH_DISABLE_SECONDS, reason=f"AI auth failed (HTTP {status_code})")
                return ""
            if status_code not in (500, 529) or attempt == _MAX_RETRIES - 1:
                logger.debug("ai_service: APIStatusError %d", status_code)
                return ""
            wait = _RETRY_BASE_WAIT * (2 ** attempt)
            logger.warning("ai_service: server error %d - retry in %.1fs", status_code, wait)
            time.sleep(wait)
        except APIConnectionError:
            logger.debug("ai_service: connection error (attempt %d)", attempt + 1)
            if attempt == _MAX_RETRIES - 1:
                return ""
            time.sleep(_RETRY_BASE_WAIT)
<<<<<<< HEAD

        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            if status_code == 429:
                # Avoid log spam and wasted retries when the project is on a free tier / low quota.
                _disable_ai_for(60.0, reason="Gemini rate limited (HTTP 429). Try again shortly or increase quota.")
                return ""
            if status_code in (500, 503) and attempt < _MAX_RETRIES - 1:
                wait = _RETRY_BASE_WAIT * (2 ** attempt)
                logger.warning("ai_service: gemini server error %d â€” retry in %.1fs", status_code, wait)
                time.sleep(wait)
                continue
            return ""

        except httpx.RequestError:
            logger.debug("ai_service: gemini connection error (attempt %d)", attempt + 1)
            if attempt == _MAX_RETRIES - 1:
                return ""
            time.sleep(_RETRY_BASE_WAIT)

=======
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            if status_code == 429:
                _disable_ai_for(60.0, reason="Gemini rate limited (HTTP 429)")
                return ""
            if status_code not in (500, 503) or attempt == _MAX_RETRIES - 1:
                return ""
            wait = _RETRY_BASE_WAIT * (2 ** attempt)
            logger.warning("ai_service: gemini server error %d - retry in %.1fs", status_code, wait)
            time.sleep(wait)
        except httpx.RequestError as exc:
            logger.debug("ai_service: gemini connection error (attempt %d): %s", attempt + 1, exc)
            if attempt == _MAX_RETRIES - 1:
                return ""
            time.sleep(_RETRY_BASE_WAIT)
>>>>>>> 2e0225834c4e9b35737288da65ee57f107aed6aa
        except Exception as exc:
            logger.debug("ai_service: unexpected error: %s", exc, exc_info=True)
            return ""
    return ""


def _parse_json(text: str) -> dict | list | None:
    content = str(text or "").strip()
    if not content:
        return None
    candidates = [content]
    fenced = re.sub(r"^```(?:json)?\s*|\s*```$", "", content, flags=re.IGNORECASE).strip()
    if fenced != content:
        candidates.append(fenced)
    match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", content)
    if match:
        candidates.append(match.group(1))
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return None


def _call_json(
    system: str,
    user: str,
    *,
    max_tokens: int = 1024,
    use_cache: bool = True,
    provider_override: str | None = None,
    anthropic_api_key: str | None = None,
    gemini_api_key: str | None = None,
) -> dict | list | None:
    text = _call(
        system,
        user,
        max_tokens=max_tokens,
        use_cache=use_cache,
        provider_override=provider_override,
        anthropic_api_key=anthropic_api_key,
        gemini_api_key=gemini_api_key,
    )
    return _parse_json(text) if text else None


def _sanitize(values: list[Any]) -> list[float]:
    clean: list[float] = []
    for value in values:
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if isfinite(number):
            clean.append(max(0.0, round(number, 4)))
    return clean


def _baseline(history: list[float], horizon: int) -> list[float]:
    series = history[-120:] if history else []
    if not series or horizon <= 0:
        return []
    if len(series) == 1:
        return [round(series[0], 2) for _ in range(horizon)]
    recent = series[-min(len(series), 7) :]
    avg = sum(recent) / max(len(recent), 1)
    slope = 0.0
    if len(series) >= 2:
        slope = (series[-1] - series[0]) / max(len(series) - 1, 1)
    return [round(max(0.0, avg + (step * slope)), 2) for step in range(1, horizon + 1)]


def _coerce_forecast(raw: Any, horizon: int) -> list[float]:
    if not isinstance(raw, list):
        return []
    forecast = [round(max(0.0, float(value)), 2) for value in raw if isinstance(value, (int, float))]
    if not forecast:
        return []
    if len(forecast) < horizon:
        forecast.extend([forecast[-1]] * (horizon - len(forecast)))
    return forecast[:horizon]


def _confidence_from_history(history: list[float]) -> float:
    if len(history) < 7:
        return 0.4
    if len(history) < 30:
        return 0.6
    try:
        avg = mean(history)
        if avg <= 0:
            return 0.5
        return round(max(0.3, min(0.95, 1.0 - ((stdev(history) / avg) * 0.5))), 2)
    except StatisticsError:
        return 0.5


def _trend_label(history: list[float]) -> str:
    if len(history) < 2:
        return "stable"
    delta = history[-1] - history[0]
    if delta > 0.5:
        return "increasing"
    if delta < -0.5:
        return "decreasing"
    return "stable"


def _demand_for_item(item: dict, avg_daily_demand: dict[str, float] | None = None) -> float:
    sku = str(item.get("sku") or item.get("productSku") or "")
    if avg_daily_demand and sku in avg_daily_demand:
        return max(float(avg_daily_demand[sku]), 0.0)
    for key in ("avgDailySales", "avg_daily_sales", "dailyDemand", "daily_demand"):
        value = item.get(key)
        if isinstance(value, (int, float)):
            return max(float(value), 0.0)
    return 0.0


def predict_demand(history: list[float], horizon: int = 3) -> list[float]:
    clean = _sanitize(history)
    baseline = _baseline(clean, horizon)
    if not clean or horizon <= 0:
        return []
    if not ai_configured():
        return baseline
    result = _call_json(_PROMPTS["forecast"], json.dumps({"history": clean[-60:], "horizon": horizon}), max_tokens=600)
    if isinstance(result, dict):
        forecast = _coerce_forecast(result.get("forecast"), horizon)
        if forecast:
            return forecast
    return baseline


def forecast_with_insights(product_name: str, history: list[float], horizon: int = 30, context: str = "") -> dict:
    clean = _sanitize(history)
    baseline = _baseline(clean, horizon)
    fallback_conf = _confidence_from_history(clean)
    fallback: dict[str, Any] = {
        "forecast": baseline,
        "confidence": fallback_conf,
        "trend": _trend_label(clean),
        "seasonality_detected": False,
        "summary": "Baseline forecast generated." if clean else "No demand history available.",
        "risk_factors": [],
        "recommended_safety_stock": int(round(max(mean(clean[-7:]) if clean else 0.0, 0.0) * 7)) if clean else None,
        "reorder_point": int(round(max(mean(clean[-7:]) if clean else 0.0, 0.0) * 5)) if clean else None,
    }
    if not clean or not ai_configured():
        return fallback
    result = _call_json(
        _PROMPTS["forecast"],
        json.dumps({"product_name": product_name, "history": clean[-90:], "horizon": horizon, "context": context}),
        max_tokens=1200,
    )
    if isinstance(result, dict):
        forecast = _coerce_forecast(result.get("forecast"), horizon) or baseline
        return {
            "forecast": forecast,
            "confidence": result.get("confidence", fallback_conf),
            "trend": result.get("trend", fallback["trend"]),
            "seasonality_detected": bool(result.get("seasonality_detected", False)),
            "summary": result.get("summary", fallback["summary"]),
            "risk_factors": result.get("risk_factors", []),
            "recommended_safety_stock": result.get("recommended_safety_stock", fallback["recommended_safety_stock"]),
            "reorder_point": result.get("reorder_point", fallback["reorder_point"]),
        }
    return fallback


def analyse_supplier_risk(supplier_name: str, supplier_data: dict, news_snippets: list[str] | None = None) -> dict:
    fallback: dict[str, Any] = {
        "overall_risk_score": 50,
        "risk_level": "medium",
        "confidence": 0.0,
        "dimensions": {name: {"score": 50, "finding": "AI unavailable"} for name in ("financial", "geopolitical", "operational", "delivery", "esg")},
        "red_flags": [],
        "positive_indicators": [],
        "recommendations": ["Manual supplier review recommended."],
        "alternative_suppliers": [],
    }
    if not ai_configured():
        return fallback
    result = _call_json(
        _PROMPTS["supplier_risk"],
        json.dumps({"supplier_name": supplier_name, "supplier_data": supplier_data, "news_snippets": news_snippets or []}),
        max_tokens=1200,
    )
    return result if isinstance(result, dict) and "overall_risk_score" in result else fallback


def optimise_delivery_route(warehouse: str, stops: list[dict], constraints: dict | None = None) -> dict:
    fallback = {
        "optimised_sequence": [
            {"stop": index + 1, "location": stop.get("location", ""), "eta": "N/A", "distance_from_prev_km": 0, "notes": ""}
            for index, stop in enumerate(stops)
        ],
        "total_distance_km": 0,
        "total_duration_hours": 0,
        "estimated_fuel_cost_inr": 0,
        "co2_kg": 0,
        "savings": {"distance_saved_km": 0, "cost_saved_inr": 0, "time_saved_hours": 0},
        "risk_factors": [],
        "recommendations": ["Route optimisation unavailable; using current stop order."],
    }
    if not ai_configured():
        return fallback
    result = _call_json(
        _PROMPTS["route"],
        json.dumps({"warehouse": warehouse, "stops": stops, "constraints": constraints or {}}),
        max_tokens=1200,
    )
    return result if isinstance(result, dict) and "optimised_sequence" in result else fallback


def predict_low_stock(inventory_data: list[dict], api_key: str = "") -> list[dict]:
    if not inventory_data:
        return []
    supplied_key = str(api_key or "").strip()
    if not (supplied_key or ai_configured()):
        return inventory_data
    provider_override: str | None = None
    anthropic_override: str | None = None
    gemini_override: str | None = None
    if supplied_key.startswith(_ANTHROPIC_KEY_PREFIX):
        provider_override = "anthropic"
        anthropic_override = supplied_key
    elif supplied_key.startswith(_GEMINI_KEY_PREFIX):
        provider_override = "gemini"
        gemini_override = supplied_key
    elif supplied_key:
        return inventory_data
    result = _call_json(
        _PROMPTS["inventory"],
        json.dumps({"inventory_data": inventory_data}),
        max_tokens=1200,
        use_cache=False,
        provider_override=provider_override,
        anthropic_api_key=anthropic_override,
        gemini_api_key=gemini_override,
    )
    if isinstance(result, dict) and isinstance(result.get("recommendations"), list):
        recommendations = [item for item in result["recommendations"] if isinstance(item, dict)]
        merged: list[dict] = []
        for item in inventory_data:
            sku = item.get("sku")
            match = next((rec for rec in recommendations if rec.get("sku") == sku), {})
            merged.append(
                {
                    **item,
                    "recommendation": match.get("recommendation", item.get("recommendation", "")),
                    "priority": match.get("priority", item.get("priority", "medium")),
                }
            )
        return merged
    return inventory_data


def check_inventory_alerts(inventory_items: list[dict], avg_daily_demand: dict[str, float] | None = None) -> dict:
    items_at_risk: list[dict] = []
    for item in inventory_items:
        current_stock = int(item.get("current_stock", item.get("currentStock", item.get("quantity", 0))) or 0)
        demand = _demand_for_item(item, avg_daily_demand)
        days_until_stockout = int(current_stock / demand) if demand > 0 else None
        reorder_qty = int(round(max((demand * 7) - current_stock, 0))) if demand > 0 else None
        if current_stock <= 0:
            status = "stockout_imminent"
        elif days_until_stockout is not None and days_until_stockout <= 3:
            status = "stockout_imminent"
        elif days_until_stockout is not None and days_until_stockout <= 7:
            status = "low"
        elif demand > 0 and current_stock > (demand * 30):
            status = "overstock"
        else:
            status = "healthy"
        if status != "healthy":
            items_at_risk.append(
                {
                    "sku": item.get("sku", item.get("productSku", "")),
                    "product_name": item.get("product_name", item.get("productName", item.get("name", ""))),
                    "current_stock": current_stock,
                    "days_until_stockout": days_until_stockout,
                    "status": status,
                    "reorder_qty": reorder_qty,
                    "action": "Reorder immediately." if status == "stockout_imminent" else "Review and replenish soon." if status == "low" else "Pause replenishment and rebalance inventory.",
                }
            )
    alert_level = "ok"
    if any(item["status"] == "stockout_imminent" for item in items_at_risk):
        alert_level = "critical"
    elif items_at_risk:
        alert_level = "warning"
    fallback = {
        "alert_level": alert_level,
        "items_at_risk": items_at_risk,
        "immediate_actions": ["Prioritise SKUs at risk of stockout."] if items_at_risk else [],
        "weekly_actions": ["Review replenishment settings and supplier lead times."] if items_at_risk else [],
        "total_reorder_cost_inr": None,
    }
    if not inventory_items or not ai_configured():
        return fallback
    result = _call_json(
        _PROMPTS["inventory"],
        json.dumps({"inventory_items": inventory_items, "avg_daily_demand": avg_daily_demand or {}}),
        max_tokens=1200,
    )
    return result if isinstance(result, dict) and "alert_level" in result else fallback


def predict_delay_risk(distance_km: float, weather_score: float, traffic_score: float) -> float:
    raw = (distance_km / 1200.0) * 0.4 + weather_score * 0.3 + traffic_score * 0.3
    return round(max(0.0, min(1.0, raw)), 3)


def detect_shipment_anomalies(tracking_id: str, tracking_events: list[dict], expected_delivery: str) -> dict:
    fallback = {
        "anomaly_detected": False,
        "severity": "none",
        "confidence": 0.0,
        "anomalies": [],
        "delay_hours": None,
        "eta_revised": None,
        "customer_message": None,
    }
    if not ai_configured():
        return fallback
    result = _call_json(
        _PROMPTS["anomaly"],
        json.dumps({"tracking_id": tracking_id, "tracking_events": tracking_events, "expected_delivery": expected_delivery}),
        max_tokens=1200,
    )
    return result if isinstance(result, dict) and "anomaly_detected" in result else fallback


def summarize_product_journey(journey: list[dict]) -> dict:
    if not journey:
        return {
            "summary": "Product journey data is still pending on the ledger.",
            "highlight": "No events recorded yet.",
            "keyStage": "pending",
            "steps": 0,
            "provenance_score": 0,
            "compliance_flags": [],
            "journey_health": "degraded",
        }
    first = journey[0]
    last = journey[-1]
    fallback: dict[str, Any] = {
        "summary": f"Chain: {first.get('eventStage', 'start')} -> {last.get('eventStage', 'current')} ({len(journey)} hops).",
        "highlight": f"Latest stage: {last.get('eventStage', 'current')}.",
        "keyStage": last.get("eventStage") or "current",
        "steps": len(journey),
        "provenance_score": min(100, 40 + (len(journey) * 8)),
        "compliance_flags": [],
        "journey_health": "good" if len(journey) >= 3 else "degraded",
    }
    if not ai_configured():
        return fallback
    result = _call_json(_PROMPTS["blockchain"], json.dumps({"journey": journey[-12:]}), max_tokens=600)
    if isinstance(result, dict) and "summary" in result:
        result["steps"] = len(journey)
        return result
    return fallback


def get_dashboard_insights(inventory_summary: dict, recent_shipments: list[dict], top_suppliers: list[dict]) -> dict:
    fallback = {
        "headline": "Supply chain data loaded. AI insights are unavailable.",
        "health_score": 50,
        "top_priority": "Review inventory and shipment exceptions.",
        "alerts": [],
        "opportunities": [],
        "weekly_summary": "Dashboard is operating in fallback mode.",
    }
    if not ai_configured():
        return fallback
    result = _call_json(
        _PROMPTS["dashboard"],
        json.dumps({"inventory_summary": inventory_summary, "recent_shipments": recent_shipments[:10], "top_suppliers": top_suppliers[:5]}),
        max_tokens=800,
    )
    return result if isinstance(result, dict) and "headline" in result else fallback


def stream_chat_response(
    question: str,
    context_data: dict | None = None,
    conversation_history: list[dict] | None = None,
    *,
    allow_data_tools: bool = False,
) -> Iterator[str]:
    if False:
        yield ""
    return


async def astream_chat_response(
    question: str,
    context_data: dict | None = None,
    conversation_history: list[dict] | None = None,
    *,
    allow_data_tools: bool = False,
) -> AsyncIterator[str]:
    if False:
        yield ""
    return


async def _acall_json(system: str, user: str, **kwargs) -> dict | list | None:
    return await _to_thread(_call_json, system, user, **kwargs)

<<<<<<< HEAD
def _extract_text(message: Any) -> str:
    blocks = getattr(message, "content", None)
    if not isinstance(blocks, list):
        return ""
    return "\n".join(
        b.text.strip() for b in blocks
        if hasattr(b, "text") and isinstance(b.text, str) and b.text.strip()
    )


def _parse_json(text: str) -> dict | list | None:
    content = text.strip()
    if not content:
        return None
    candidates = [content]
    fenced = re.sub(r"^```(?:json)?\s*|\s*```$", "", content, flags=re.IGNORECASE).strip()
    if fenced != content:
        candidates.append(fenced)
    m = re.search(r"\{[\s\S]*\}", content)
    if m:
        candidates.append(m.group(0))
    for c in candidates:
        try:
            return json.loads(c)
        except json.JSONDecodeError:
            continue
    return None


# ── Statistical helpers ───────────────────────────────────────────────────────

def _sanitize(values: list) -> list[float]:
    out = []
    for v in values:
        try:
            n = float(v)
        except (TypeError, ValueError):
            continue
        if isfinite(n):
            out.append(max(0.0, round(n, 4)))
    return out


def _baseline(history: list[float], horizon: int) -> list[float]:
    series = list(history[-120:]) if history else []
    if not series or horizon <= 0:
        return []
    if len(series) == 1:
        base = float(series[0])
        return [round(max(0.0, base), 2) for _ in range(horizon)]

    # Holt's linear trend method (double exponential smoothing) with a small grid search.
    def score(alpha: float, beta: float) -> tuple[float, float, float]:
        level = float(series[0])
        trend = float(series[1] - series[0])
        sse = 0.0
        for idx in range(1, len(series)):
            pred = level + trend
            err = float(series[idx]) - pred
            sse += err * err
            prev_level = level
            level = alpha * float(series[idx]) + (1 - alpha) * (level + trend)
            trend = beta * (level - prev_level) + (1 - beta) * trend
        return sse, level, trend

    candidates = [0.2, 0.35, 0.5, 0.65, 0.8]
    best = (float("inf"), float(series[-1]), 0.0)
    for alpha in candidates:
        for beta in candidates:
            try:
                sse, level, trend = score(alpha, beta)
            except Exception:
                continue
            if isfinite(sse) and sse < best[0] and isfinite(level) and isfinite(trend):
                best = (sse, level, trend)

    _, level, trend = best
    return [round(max(0.0, float(level + (step + 1) * trend)), 2) for step in range(horizon)]


def _coerce_forecast(raw: list, horizon: int) -> list[float]:
    out = [round(max(0.0, float(v)), 2) for v in raw
           if isinstance(v, (int, float)) and isfinite(float(v))]
    if not out:
        return []
    if len(out) < horizon:
        out += [out[-1]] * (horizon - len(out))
    return out[:horizon]


def _confidence_from_history(history: list[float]) -> float:
    if len(history) < 7:
        return 0.4
    if len(history) < 30:
        return 0.6
    try:
        cv = stdev(history) / mean(history) if mean(history) > 0 else 1.0
        return round(max(0.3, min(0.95, 1.0 - cv * 0.5)), 2)
    except Exception:
        return 0.5


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ══════════════════════════════════════════════════════════════════════════════

# ── 1. Demand Forecasting ─────────────────────────────────────────────────────

def predict_demand(history: list[float], horizon: int = 3) -> list[float]:
    """
    Predict demand for the next `horizon` periods.
    Backward-compatible with the original Gemini version.
    Falls back to weighted moving average if Claude is unavailable.
    """
    if horizon <= 0:
        return []
    clean = _sanitize(history)
    if not clean:
        return []
    baseline = _baseline(clean, horizon)
    if not ai_configured():
        return baseline
    user = (
        f"Sales history ({len(clean)} points): {clean[-60:]}\n"
        f"Forecast {horizon} periods ahead.\n"
        f'Return JSON: {{"forecast": [exactly {horizon} positive numbers], "summary": "..."}}'
    )
    result = _call_json(_PROMPTS["forecast"], user, max_tokens=512)
    if isinstance(result, dict):
        raw = result.get("forecast")
        if isinstance(raw, list):
            coerced = _coerce_forecast(raw, horizon)
            return coerced if coerced else baseline
    return baseline


def forecast_with_insights(
    product_name: str,
    history: list[float],
    horizon: int = 30,
    context: str = "",
) -> dict:
    """
    Full demand forecast with confidence, trend detection, seasonality,
    safety stock recommendation, and reorder point.
    Powers the Forecast dashboard page.
    """
    clean = _sanitize(history)
    baseline = _baseline(clean, horizon) if clean else []
    fallback_conf = _confidence_from_history(clean)

    user = (
        f"Product: {product_name}\n"
        f"History ({len(clean)} points, most recent last): {clean[-90:]}\n"
        f"Horizon: {horizon} days\n"
        f"{'Context: ' + context if context else ''}\n\n"
        "Provide a complete forecast with confidence score, trend, seasonality, "
        "safety stock recommendation, and reorder point."
    )
    result = _call_json(_PROMPTS["forecast"], user, max_tokens=1200)

    if isinstance(result, dict):
        raw = result.get("forecast", [])
        coerced = _coerce_forecast(raw, horizon) if isinstance(raw, list) else baseline
        return {
            "forecast":                 coerced or baseline,
            "confidence":               result.get("confidence", fallback_conf),
            "trend":                    result.get("trend", "stable"),
            "seasonality_detected":     result.get("seasonality_detected", False),
            "summary":                  result.get("summary", "Forecast generated."),
            "risk_factors":             result.get("risk_factors", []),
            "recommended_safety_stock": result.get("recommended_safety_stock"),
            "reorder_point":            result.get("reorder_point"),
        }

    return {
        "forecast":               baseline,
        "confidence":             fallback_conf,
        "trend":                  "stable",
        "seasonality_detected":   False,
        "summary":                "Baseline forecast (AI unavailable).",
        "risk_factors":           [],
        "recommended_safety_stock": None,
        "reorder_point":          None,
    }


# ── 2. Supplier Risk ──────────────────────────────────────────────────────────

def analyse_supplier_risk(
    supplier_name: str,
    supplier_data: dict,
    news_snippets: list[str] | None = None,
) -> dict:
    """Multi-dimension supplier risk scoring (1–100, higher = riskier)."""
    news = "\n".join(f"• {n}" for n in (news_snippets or [])) or "No recent news."
    user = (
        f"Supplier: {supplier_name}\n\n"
        f"Profile:\n{json.dumps(supplier_data, indent=2)}\n\n"
        f"Recent news:\n{news}\n\n"
        "Provide a complete multi-dimension risk assessment."
    )
    result = _call_json(_PROMPTS["supplier_risk"], user, max_tokens=1400)

    if isinstance(result, dict) and "overall_risk_score" in result:
        return result

    return {
        "overall_risk_score": 50,
        "risk_level":         "medium",
        "confidence":         0.0,
        "dimensions": {d: {"score": 50, "finding": "AI unavailable"}
                       for d in ("financial", "geopolitical", "operational", "delivery", "esg")},
        "red_flags":             [],
        "positive_indicators":   [],
        "recommendations":       ["Manual review recommended."],
        "alternative_suppliers": [],
    }


# ── 3. Route Optimisation ─────────────────────────────────────────────────────

def optimise_delivery_route(
    warehouse: str,
    stops: list[dict],
    constraints: dict | None = None,
) -> dict:
    """
    Optimise delivery route with fuel cost (INR), CO2, and savings.
    Assumes ₹90/L diesel, 10 km/L, 2.68 kg CO2/L.
    """
    user = (
        f"Warehouse / origin: {warehouse}\n\n"
        f"Delivery stops ({len(stops)}):\n{json.dumps(stops, indent=2)}\n\n"
        f"Constraints:\n{json.dumps(constraints or {}, indent=2)}\n\n"
        "Optimise stop sequence. Estimate distances, fuel cost (INR at ₹90/L diesel, "
        "10 km/L), CO2 (2.68 kg/L), and savings vs naive current order."
    )
    result = _call_json(_PROMPTS["route"], user, max_tokens=1400)

    if isinstance(result, dict) and "optimised_sequence" in result:
        return result

    return {
        "optimised_sequence": [
            {"stop": i + 1, "location": s.get("location", ""), "eta": "N/A",
             "distance_from_prev_km": 0, "notes": ""}
            for i, s in enumerate(stops)
        ],
        "total_distance_km":       0,
        "total_duration_hours":    0,
        "estimated_fuel_cost_inr": 0,
        "co2_kg":                  0,
        "savings": {"distance_saved_km": 0, "cost_saved_inr": 0, "time_saved_hours": 0},
        "risk_factors":    [],
        "recommendations": ["Route optimisation unavailable — AI offline."],
    }


# ── 4. Inventory Alerts ───────────────────────────────────────────────────────

def predict_low_stock(inventory_data: list[dict], api_key: str = "") -> list[dict]:
    """
    Backward-compatible: annotate each inventory item with AI priority + recommendation.
    Same input/output shape as the original Gemini version.
    """
    if not inventory_data:
        return inventory_data
    if not (str(api_key or "").strip() or ai_configured()):
        return inventory_data

    user = (
        "Analyse this inventory. For each SKU assign priority "
        "('high', 'medium', 'low') and write a short recommendation.\n\n"
        f"Data:\n{json.dumps(inventory_data, indent=2)}\n\n"
        'Return JSON: {"recommendations": [{"sku":"...","priority":"...","recommendation":"..."}]}'
    )
    result = _call_json(_PROMPTS["inventory"], user, max_tokens=1200, use_cache=False)

    if isinstance(result, dict) and "recommendations" in result:
        ai_recs = result["recommendations"]
        merged = []
        for item in inventory_data:
            sku = item.get("sku")
            match = next((r for r in ai_recs if r.get("sku") == sku), {})
            merged.append({
                **item,
                "recommendation": match.get("recommendation", item.get("recommendation", "")),
                "priority":       match.get("priority",       item.get("priority", "medium")),
            })
        return merged

    return inventory_data


def check_inventory_alerts(
    inventory_items: list[dict],
    avg_daily_demand: dict[str, float] | None = None,
) -> dict:
    """Full inventory health check with stockout days, reorder quantities, and action plan."""
    user = (
        f"Inventory snapshot ({len(inventory_items)} SKUs):\n"
        f"{json.dumps(inventory_items, indent=2)}\n\n"
        f"Average daily demand:\n{json.dumps(avg_daily_demand or {}, indent=2)}\n\n"
        "Identify stockout risks, overstock situations, and produce a prioritised action plan."
    )
    result = _call_json(_PROMPTS["inventory"], user, max_tokens=1400)

    if isinstance(result, dict) and "alert_level" in result:
        return result

    return {
        "alert_level":           "info",
        "items_at_risk":         [],
        "immediate_actions":     ["Manual inventory review recommended."],
        "weekly_actions":        [],
        "total_reorder_cost_inr": None,
    }


# ── 5. Shipment Anomaly Detection ─────────────────────────────────────────────

def predict_delay_risk(distance_km: float, weather_score: float, traffic_score: float) -> float:
    """
    Normalised delay probability [0, 1].
    Pure maths — no API call — for low-latency real-time use.
    """
    raw = (distance_km / 1200) * 0.4 + weather_score * 0.3 + traffic_score * 0.3
    return round(max(0.0, min(1.0, raw)), 3)


def detect_shipment_anomalies(
    tracking_id: str,
    tracking_events: list[dict],
    expected_delivery: str,
) -> dict:
    """Deep anomaly detection with severity, revised ETA, and customer message."""
    user = (
        f"Tracking ID: {tracking_id}\n"
        f"Expected delivery: {expected_delivery}\n\n"
        f"Tracking events ({len(tracking_events)}):\n"
        f"{json.dumps(tracking_events, indent=2)}\n\n"
        "Detect delays, route deviations, data gaps, and status inconsistencies."
    )
    result = _call_json(_PROMPTS["anomaly"], user, max_tokens=1200)

    if isinstance(result, dict) and "anomaly_detected" in result:
        return result

    return {
        "anomaly_detected": False,
        "severity":         "none",
        "confidence":       0.0,
        "anomalies":        [],
        "delay_hours":      None,
        "eta_revised":      None,
        "customer_message": None,
    }


# ── 6. Blockchain Journey ─────────────────────────────────────────────────────

def summarize_product_journey(journey: list[dict]) -> dict:
    """
    Summarise a blockchain product provenance journey.
    Backward-compatible with the original Gemini version.
    """
    if not journey:
        return {
            "summary":         "Product journey data is still pending on the ledger.",
            "highlight":       "No events yet — scan again after the next scan-in.",
            "keyStage":        "pending",
            "steps":           0,
            "provenance_score": 0,
            "compliance_flags": [],
            "journey_health":  "degraded",
        }

    events = [
        f"{s.get('eventStage') or s.get('stage','unknown')} "
        f"at {s.get('timestamp') or s.get('createdAt','unknown')}"
        for s in journey[-8:]
    ]
    user = (
        f"Product journey — {len(journey)} blockchain events.\n"
        "Recent events:\n" + "\n".join(f"  • {e}" for e in events) + "\n\n"
        "Summarise provenance, rate journey health, and flag compliance issues."
    )
    result = _call_json(_PROMPTS["blockchain"], user, max_tokens=600)

    if isinstance(result, dict) and "summary" in result:
        return {**result, "steps": len(journey)}

    first, last = journey[0], journey[-1]
    return {
        "summary":   f"Chain: {first.get('eventStage','start')} → "
                     f"{last.get('eventStage','current')} ({len(journey)} hops).",
        "highlight": f"Latest: {last.get('eventStage','current')} @ "
                     f"{last.get('timestamp','unknown')}.",
        "keyStage":         last.get("eventStage") or "current",
        "steps":            len(journey),
        "provenance_score": 60,
        "compliance_flags": [],
        "journey_health":   "good",
    }


# 7. (Chat removed)

# ── 8. Dashboard Insights ─────────────────────────────────────────────────────

def get_dashboard_insights(
    inventory_summary: dict,
    recent_shipments: list[dict],
    top_suppliers: list[dict],
) -> dict:
    """Single Claude call that powers the Admin dashboard AI insights panel."""
    user = (
        "Today's supply chain snapshot:\n\n"
        f"Inventory:\n{json.dumps(inventory_summary, indent=2)}\n\n"
        f"Recent shipments (last 10):\n{json.dumps(recent_shipments[:10], indent=2)}\n\n"
        f"Top suppliers:\n{json.dumps(top_suppliers[:5], indent=2)}\n\n"
        "Generate a boardroom-ready supply chain briefing."
    )
    result = _call_json(_PROMPTS["dashboard"], user, max_tokens=800)

    if isinstance(result, dict) and "headline" in result:
        return result

    return {
        "headline":      "Supply chain data loaded. AI insights temporarily unavailable.",
        "health_score":  50,
        "top_priority":  "Review AI service configuration.",
        "alerts":        [],
        "opportunities": [],
        "weekly_summary": "Dashboard operating in offline mode.",
    }


# ── 9. Async versions of all heavy calls ─────────────────────────────────────
=======
>>>>>>> 2e0225834c4e9b35737288da65ee57f107aed6aa

async def aforecast_with_insights(product_name: str, history: list[float], horizon: int = 30, context: str = "") -> dict:
    return await _to_thread(forecast_with_insights, product_name, history, horizon, context)


async def aanalyse_supplier_risk(name: str, data: dict, news: list[str] | None = None) -> dict:
    return await _to_thread(analyse_supplier_risk, name, data, news)


async def aoptimise_delivery_route(warehouse: str, stops: list[dict], constraints: dict | None = None) -> dict:
    return await _to_thread(optimise_delivery_route, warehouse, stops, constraints)


async def acheck_inventory_alerts(items: list[dict], demand: dict | None = None) -> dict:
    return await _to_thread(check_inventory_alerts, items, demand)


async def adetect_shipment_anomalies(tid: str, events: list[dict], expected: str) -> dict:
    return await _to_thread(detect_shipment_anomalies, tid, events, expected)


async def aget_dashboard_insights(inv: dict, shipments: list[dict], suppliers: list[dict]) -> dict:
    return await _to_thread(get_dashboard_insights, inv, shipments, suppliers)
