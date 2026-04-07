"""Task management tools for J.A.R.V.I.S."""

from typing import Optional

from core.api_client import BackendClient
from core.server import mcp

client = BackendClient()


@mcp.tool()
async def create_task(
    title: str,
    type: str,
    source_type: Optional[str] = None,
    source_id: Optional[str] = None,
) -> dict:
    """Create a new task.

    Args:
        title: Task title.
        type: Must be one of: refinement, implementation, review.
        source_type: Optional source origin — 'jira' or 'gcal'.
        source_id: Optional external ID (e.g. JIRA key 'AG-22' or GCal event ID).
    """
    return await client.create_task(
        title=title, type=type, source_type=source_type, source_id=source_id
    )


@mcp.tool()
async def get_task(task_id: int) -> dict:
    """Get a single task by ID, including its assigned dates and notes."""
    task = await client.get_task(task_id)
    task["notes"] = await client.list_task_notes(task_id)
    return task


@mcp.tool()
async def list_tasks(
    date: Optional[str] = None,
    scope: str = "all",
) -> list[dict]:
    """List tasks. Optionally filter by date (YYYY-MM-DD) and scope (daily, weekly, all)."""
    return await client.list_tasks(date=date, scope=scope)


@mcp.tool()
async def update_task(
    task_id: int,
    title: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    source_type: Optional[str] = None,
    source_id: Optional[str] = None,
) -> dict:
    """Update a task's fields. Only provided fields are changed.

    Args:
        task_id: ID of the task to update.
        title: New title.
        type: New type — refinement, implementation, or review.
        status: New status — created or done.
        source_type: Source origin — 'jira' or 'gcal'.
        source_id: External ID (e.g. JIRA key or GCal event ID).
    """
    fields = {}
    if title is not None:
        fields["title"] = title
    if type is not None:
        fields["type"] = type
    if status is not None:
        fields["status"] = status
    if source_type is not None:
        fields["source_type"] = source_type
    if source_id is not None:
        fields["source_id"] = source_id
    return await client.update_task(task_id, **fields)


@mcp.tool()
async def delete_task(task_id: int) -> str:
    """Delete a task by ID. All associated notes are also deleted."""
    await client.delete_task(task_id)
    return f"Task {task_id} and all its notes have been deleted"
