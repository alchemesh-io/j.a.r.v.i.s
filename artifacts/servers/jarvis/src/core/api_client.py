import os
from typing import Any, Optional

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


class BackendClient:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or BACKEND_URL).rstrip("/")
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=30.0)

    async def close(self):
        await self.client.aclose()

    async def _request(self, method: str, path: str, **kwargs) -> Any:
        try:
            response = await self.client.request(method, path, **kwargs)
            response.raise_for_status()
            if response.status_code == 204:
                return None
            return response.json()
        except httpx.ConnectError:
            raise RuntimeError(f"Backend unreachable at {self.base_url}")

    # --- Tasks ---

    async def create_task(
        self,
        title: str,
        type: str,
        jira_ticket_id: Optional[str] = None,
        status: str = "created",
    ) -> dict:
        body: dict[str, Any] = {"title": title, "type": type, "status": status}
        if jira_ticket_id:
            body["jira_ticket_id"] = jira_ticket_id
        return await self._request("POST", "/api/v1/tasks", json=body)

    async def list_tasks(
        self,
        date: Optional[str] = None,
        scope: str = "all",
    ) -> list[dict]:
        params: dict[str, str] = {"scope": scope}
        if date:
            params["date"] = date
        return await self._request("GET", "/api/v1/tasks", params=params)

    async def update_task(self, task_id: int, **fields) -> dict:
        return await self._request("PATCH", f"/api/v1/tasks/{task_id}", json=fields)

    async def delete_task(self, task_id: int) -> None:
        await self._request("DELETE", f"/api/v1/tasks/{task_id}")

    # --- Dailies ---

    async def create_daily(self, date: str, weekly_id: int) -> dict:
        return await self._request(
            "POST", "/api/v1/dailies", json={"date": date, "weekly_id": weekly_id}
        )

    async def get_daily_by_date(self, date: str) -> dict:
        return await self._request("GET", "/api/v1/dailies", params={"date": date})

    async def add_task_to_daily(
        self, daily_id: int, task_id: int, priority: int
    ) -> dict:
        return await self._request(
            "POST",
            f"/api/v1/dailies/{daily_id}/tasks",
            json={"task_id": task_id, "priority": priority},
        )

    async def remove_task_from_daily(self, daily_id: int, task_id: int) -> None:
        await self._request("DELETE", f"/api/v1/dailies/{daily_id}/tasks/{task_id}")

    # --- Weeklies ---

    async def list_weekly_tasks(self, date: str) -> list[dict]:
        return await self._request(
            "GET", "/api/v1/tasks", params={"date": date, "scope": "weekly"}
        )

    # --- JIRA ---

    async def get_jira_config(self) -> dict:
        return await self._request("GET", "/api/v1/jira/config")

    async def list_jira_tickets(self) -> list[dict]:
        return await self._request("GET", "/api/v1/jira/tickets")

    async def get_jira_ticket(self, key: str) -> dict:
        return await self._request("GET", "/api/v1/jira/ticket", params={"key": key})

    # --- Google Calendar ---

    async def get_gcal_auth_status(self) -> dict:
        return await self._request("GET", "/api/v1/gcal/auth/status")

    async def get_gcal_event(self, event_id: str) -> dict:
        return await self._request("GET", "/api/v1/gcal/event", params={"event_id": event_id})

    async def list_gcal_events(self, date: str, view: str = "daily") -> list[dict]:
        return await self._request(
            "GET", "/api/v1/gcal/events", params={"date": date, "view": view}
        )
