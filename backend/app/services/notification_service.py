from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

from fastapi import WebSocket

from app.services.database_service import create_notification, list_notifications


class NotificationService:
    def __init__(self) -> None:
        self._subscribers: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._subscribers.setdefault(user_id, set()).add(websocket)

    async def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self._subscribers.get(user_id)
            if not sockets:
                return
            sockets.discard(websocket)
            if not sockets:
                self._subscribers.pop(user_id, None)

    async def _broadcast(self, user_id: str, payload: dict) -> None:
        async with self._lock:
            targets = list(self._subscribers.get(user_id, set()))

        stale: list[WebSocket] = []
        for websocket in targets:
            try:
                await websocket.send_json(payload)
            except Exception:
                stale.append(websocket)

        if stale:
            async with self._lock:
                sockets = self._subscribers.get(user_id, set())
                for item in stale:
                    sockets.discard(item)
                if not sockets:
                    self._subscribers.pop(user_id, None)

    def publish(
        self,
        user_id: str,
        title: str,
        message: str,
        severity: str = "info",
        metadata: dict | None = None,
    ) -> dict:
        event = create_notification(
            user_id=user_id,
            title=title,
            message=message,
            severity=severity,
            metadata_payload=metadata or {},
        )
        payload = {
            "type": "notification",
            "id": event.get("id"),
            "user_id": user_id,
            "title": title,
            "message": message,
            "severity": severity,
            "metadata": metadata or {},
            "timestamp": (
                event["created_at"].isoformat()
                if isinstance(event.get("created_at"), datetime)
                else str(event.get("created_at") or "")
            ),
        }

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop is not None:
            loop.create_task(self._broadcast(user_id, payload))
        else:
            asyncio.run(self._broadcast(user_id, payload))

        return payload

    def list_recent(self, limit: int = 50, user_id: str | None = None) -> list[dict[str, Any]]:
        items = list_notifications(user_id=user_id, limit=limit)
        normalized: list[dict[str, Any]] = []
        for event in items:
            created_at = event.get("created_at")
            normalized.append(
                {
                    "id": event.get("id"),
                    "user_id": event.get("user_id"),
                    "title": event.get("title"),
                    "message": event.get("message"),
                    "severity": event.get("severity"),
                    "metadata": event.get("metadata") or {},
                    "timestamp": (
                        created_at.isoformat()
                        if isinstance(created_at, datetime)
                        else str(created_at or "")
                    ),
                }
            )
        return normalized


notification_service = NotificationService()
