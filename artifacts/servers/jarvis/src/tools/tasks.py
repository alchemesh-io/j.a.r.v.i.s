"""Task management tools for J.A.R.V.I.S."""

from typing import Optional

from core.api_client import BackendClient
from core.server import mcp

client = BackendClient()


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
