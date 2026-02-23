from __future__ import annotations

from datetime import datetime, timezone


class NotificationService:
    def __init__(self) -> None:
        self._events: list[dict] = []

    def publish(self, user_id: str, title: str, message: str, severity: str = "info") -> dict:
        event = {
            "user_id": user_id,
            "title": title,
            "message": message,
            "severity": severity,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self._events.append(event)
        return event

    def list_recent(self, limit: int = 50) -> list[dict]:
        return list(reversed(self._events[-limit:]))


notification_service = NotificationService()
