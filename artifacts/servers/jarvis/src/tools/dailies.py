"""Daily planning tools for J.A.R.V.I.S."""

from core.api_client import BackendClient
from core.server import mcp

client = BackendClient()


@mcp.tool()
async def create_daily(date: str, weekly_id: int) -> dict:
    """Create a daily planning entry for a given date, linked to a weekly.

    Args:
        date: Date in YYYY-MM-DD format.
        weekly_id: ID of the parent weekly.
    """
    return await client.create_daily(date=date, weekly_id=weekly_id)


@mcp.tool()
async def get_daily(daily_id: int) -> dict:
    """Get a daily planning entry by ID, including its tasks ordered by priority."""
    return await client.get_daily(daily_id)


@mcp.tool()
async def get_daily_by_date(date: str) -> dict:
    """Get the daily planning entry for a specific date, including its tasks.

    Args:
        date: Date in YYYY-MM-DD format.
    """
    return await client.get_daily_by_date(date=date)


@mcp.tool()
async def add_task_to_daily(daily_id: int, task_id: int, priority: int) -> dict:
    """Add a task to a daily planning at a given priority.

    Args:
        daily_id: ID of the daily.
        task_id: ID of the task to add.
        priority: Priority order (lower = higher priority).
    """
    return await client.add_task_to_daily(
        daily_id=daily_id, task_id=task_id, priority=priority
    )


@mcp.tool()
async def remove_task_from_daily(daily_id: int, task_id: int) -> str:
    """Remove a task from a daily planning.

    Args:
        daily_id: ID of the daily.
        task_id: ID of the task to remove.
    """
    await client.remove_task_from_daily(daily_id=daily_id, task_id=task_id)
    return f"Task {task_id} removed from daily {daily_id}"


@mcp.tool()
async def reorder_daily_tasks(daily_id: int, items: list[dict]) -> list[dict]:
    """Reorder tasks within a daily planning.

    Args:
        daily_id: ID of the daily.
        items: List of {task_id, priority} objects defining the new order.
    """
    return await client.reorder_daily_tasks(daily_id=daily_id, items=items)
