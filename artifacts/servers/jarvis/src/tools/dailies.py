"""Daily planning tools for J.A.R.V.I.S."""

from core.api_client import BackendClient
from core.server import mcp

client = BackendClient()


@mcp.tool()
async def create_daily(date: str, weekly_id: int) -> dict:
    """Create a daily planning entry for a given date, linked to a weekly."""
    return await client.create_daily(date=date, weekly_id=weekly_id)


@mcp.tool()
async def add_task_to_daily(daily_id: int, task_id: int, priority: int) -> dict:
    """Add a task to a daily planning at a given priority."""
    return await client.add_task_to_daily(
        daily_id=daily_id, task_id=task_id, priority=priority
    )


@mcp.tool()
async def remove_task_from_daily(daily_id: int, task_id: int) -> str:
    """Remove a task from a daily planning."""
    await client.remove_task_from_daily(daily_id=daily_id, task_id=task_id)
    return f"Task {task_id} removed from daily {daily_id}"


@mcp.tool()
async def list_daily_tasks(date: str) -> dict:
    """List all tasks for a specific date, ordered by priority."""
    return await client.get_daily_by_date(date=date)
