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
        source_type: Optional[str] = None,
        source_id: Optional[str] = None,
        status: str = "created",
    ) -> dict:
        body: dict[str, Any] = {"title": title, "type": type, "status": status}
        if source_type:
            body["source_type"] = source_type
        if source_id:
            body["source_id"] = source_id
        return await self._request("POST", "/api/v1/tasks", json=body)

    async def get_task(self, task_id: int) -> dict:
        return await self._request("GET", f"/api/v1/tasks/{task_id}")

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

    # --- Task Notes ---

    async def create_task_note(self, task_id: int, content: str) -> dict:
        return await self._request(
            "POST", f"/api/v1/tasks/{task_id}/notes", json={"content": content}
        )

    async def list_task_notes(self, task_id: int) -> list[dict]:
        return await self._request("GET", f"/api/v1/tasks/{task_id}/notes")

    async def update_task_note(
        self, task_id: int, note_id: int, content: str
    ) -> dict:
        return await self._request(
            "PATCH",
            f"/api/v1/tasks/{task_id}/notes/{note_id}",
            json={"content": content},
        )

    async def delete_task_note(self, task_id: int, note_id: int) -> None:
        await self._request("DELETE", f"/api/v1/tasks/{task_id}/notes/{note_id}")

    # --- Weeklies ---

    async def create_weekly(self, week_start: str) -> dict:
        return await self._request(
            "POST", "/api/v1/weeklies", json={"week_start": week_start}
        )

    async def list_weeklies(self) -> list[dict]:
        return await self._request("GET", "/api/v1/weeklies")

    async def get_weekly(self, weekly_id: int) -> dict:
        return await self._request("GET", f"/api/v1/weeklies/{weekly_id}")

    # --- Dailies ---

    async def create_daily(self, date: str, weekly_id: int) -> dict:
        return await self._request(
            "POST", "/api/v1/dailies", json={"date": date, "weekly_id": weekly_id}
        )

    async def get_daily(self, daily_id: int) -> dict:
        return await self._request("GET", f"/api/v1/dailies/{daily_id}")

    async def get_daily_by_date(self, date: str) -> dict:
        return await self._request("GET", "/api/v1/dailies", params={"date": date})

    # --- Daily Tasks ---

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

    async def reorder_daily_tasks(
        self, daily_id: int, items: list[dict]
    ) -> list[dict]:
        return await self._request(
            "PUT",
            f"/api/v1/dailies/{daily_id}/tasks/reorder",
            json={"items": items},
        )

    # --- Key Focuses ---

    async def create_key_focus(
        self,
        title: str,
        kind: str,
        frequency: str,
        weekly_id: int,
        description: Optional[str] = None,
        status: str = "in_progress",
    ) -> dict:
        body: dict[str, Any] = {
            "title": title,
            "kind": kind,
            "frequency": frequency,
            "weekly_id": weekly_id,
            "status": status,
        }
        if description:
            body["description"] = description
        return await self._request("POST", "/api/v1/key-focuses", json=body)

    async def get_key_focus(self, key_focus_id: int) -> dict:
        return await self._request("GET", f"/api/v1/key-focuses/{key_focus_id}")

    async def list_key_focuses(
        self,
        weekly_id: Optional[int] = None,
        frequency: Optional[str] = None,
        date: Optional[str] = None,
        scope: str = "all",
    ) -> list[dict]:
        params: dict[str, str] = {"scope": scope}
        if weekly_id is not None:
            params["weekly_id"] = str(weekly_id)
        if frequency:
            params["frequency"] = frequency
        if date:
            params["date"] = date
        return await self._request("GET", "/api/v1/key-focuses", params=params)

    async def update_key_focus(self, key_focus_id: int, **fields) -> dict:
        return await self._request(
            "PATCH", f"/api/v1/key-focuses/{key_focus_id}", json=fields
        )

    async def delete_key_focus(self, key_focus_id: int) -> None:
        await self._request("DELETE", f"/api/v1/key-focuses/{key_focus_id}")

    # --- Key Focus - Task Associations ---

    async def add_task_to_key_focus(
        self, key_focus_id: int, task_id: int
    ) -> dict:
        return await self._request(
            "POST",
            f"/api/v1/key-focuses/{key_focus_id}/tasks",
            json={"task_id": task_id},
        )

    async def remove_task_from_key_focus(
        self, key_focus_id: int, task_id: int
    ) -> None:
        await self._request(
            "DELETE", f"/api/v1/key-focuses/{key_focus_id}/tasks/{task_id}"
        )

    async def list_key_focus_tasks(self, key_focus_id: int) -> list[dict]:
        return await self._request(
            "GET", f"/api/v1/key-focuses/{key_focus_id}/tasks"
        )

    # --- Key Focus - Blockers ---

    async def list_key_focus_blockers(self, key_focus_id: int) -> list[dict]:
        return await self._request(
            "GET", f"/api/v1/key-focuses/{key_focus_id}/blockers"
        )

    # --- Blockers ---

    async def create_blocker(
        self,
        title: str,
        task_id: Optional[int] = None,
        key_focus_id: Optional[int] = None,
        description: Optional[str] = None,
    ) -> dict:
        body: dict[str, Any] = {"title": title}
        if task_id is not None:
            body["task_id"] = task_id
        if key_focus_id is not None:
            body["key_focus_id"] = key_focus_id
        if description:
            body["description"] = description
        return await self._request("POST", "/api/v1/blockers", json=body)

    async def get_blocker(self, blocker_id: int) -> dict:
        return await self._request("GET", f"/api/v1/blockers/{blocker_id}")

    async def list_blockers(
        self, status: Optional[str] = None
    ) -> list[dict]:
        params: dict[str, str] = {}
        if status:
            params["status"] = status
        return await self._request("GET", "/api/v1/blockers", params=params)

    async def update_blocker(self, blocker_id: int, **fields) -> dict:
        return await self._request(
            "PATCH", f"/api/v1/blockers/{blocker_id}", json=fields
        )

    async def delete_blocker(self, blocker_id: int) -> None:
        await self._request("DELETE", f"/api/v1/blockers/{blocker_id}")

    # --- Task Blockers ---

    async def list_task_blockers(self, task_id: int) -> list[dict]:
        return await self._request("GET", f"/api/v1/tasks/{task_id}/blockers")
