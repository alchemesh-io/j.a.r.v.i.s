from typing import Optional

from mcp.server.fastmcp import FastMCP

from api_client import BackendClient

mcp = FastMCP("jarvis-tasks")
client = BackendClient()


# --- Task tools ---


@mcp.tool()
async def create_task(
    title: str,
    type: str,
    jira_ticket_id: Optional[str] = None,
) -> dict:
    """Create a new task. Type must be one of: refinement, implementation, review."""
    return await client.create_task(
        title=title, type=type, jira_ticket_id=jira_ticket_id
    )


@mcp.tool()
async def list_tasks(
    date: Optional[str] = None,
    scope: str = "all",
) -> list[dict]:
    """List tasks. Optionally filter by date and scope (daily, weekly, all)."""
    return await client.list_tasks(date=date, scope=scope)


@mcp.tool()
async def update_task(
    task_id: int,
    title: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    jira_ticket_id: Optional[str] = None,
) -> dict:
    """Update a task's fields. Only provided fields are updated."""
    fields = {}
    if title is not None:
        fields["title"] = title
    if type is not None:
        fields["type"] = type
    if status is not None:
        fields["status"] = status
    if jira_ticket_id is not None:
        fields["jira_ticket_id"] = jira_ticket_id
    return await client.update_task(task_id, **fields)


@mcp.tool()
async def delete_task(task_id: int) -> str:
    """Delete a task by ID."""
    await client.delete_task(task_id)
    return f"Task {task_id} deleted"


# --- Daily planning tools ---


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


# --- Weekly planning tools ---


@mcp.tool()
async def list_weekly_tasks(date: str) -> list[dict]:
    """List all tasks for the week containing the given date."""
    return await client.list_weekly_tasks(date=date)


if __name__ == "__main__":
    mcp.run(transport="sse")
