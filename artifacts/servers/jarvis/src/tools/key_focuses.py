"""Key focus management tools for J.A.R.V.I.S."""

from typing import Optional

from core.api_client import BackendClient
from core.server import mcp

client = BackendClient()


@mcp.tool()
async def create_key_focus(
    title: str,
    kind: str,
    frequency: str,
    weekly_id: int,
    description: Optional[str] = None,
) -> dict:
    """Create a new key focus.

    Args:
        title: Key focus title.
        kind: Must be one of: delivery, learning, support, operational, side_quest.
        frequency: Must be one of: weekly, quarterly.
        weekly_id: ID of the weekly to associate with.
        description: Optional description.
    """
    return await client.create_key_focus(
        title=title,
        kind=kind,
        frequency=frequency,
        weekly_id=weekly_id,
        description=description,
    )


@mcp.tool()
async def get_key_focus(key_focus_id: int) -> dict:
    """Get a single key focus by ID, including associated tasks and blockers."""
    kf = await client.get_key_focus(key_focus_id)
    kf["tasks"] = await client.list_key_focus_tasks(key_focus_id)
    kf["blockers"] = await client.list_key_focus_blockers(key_focus_id)
    return kf


@mcp.tool()
async def list_key_focuses(
    date: Optional[str] = None,
    scope: str = "all",
    frequency: Optional[str] = None,
    weekly_id: Optional[int] = None,
) -> list[dict]:
    """List key focuses with optional filtering.

    Args:
        date: Filter by date (YYYY-MM-DD).
        scope: Time scope — weekly, quarterly, or all.
        frequency: Filter by frequency — weekly or quarterly.
        weekly_id: Filter by specific weekly ID.
    """
    return await client.list_key_focuses(
        date=date, scope=scope, frequency=frequency, weekly_id=weekly_id
    )


@mcp.tool()
async def update_key_focus(
    key_focus_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    kind: Optional[str] = None,
    status: Optional[str] = None,
    frequency: Optional[str] = None,
) -> dict:
    """Update a key focus's fields. Only provided fields are changed.

    Args:
        key_focus_id: ID of the key focus to update.
        title: New title.
        description: New description.
        kind: New kind — delivery, learning, support, operational, side_quest.
        status: New status — in_progress, succeed, or failed.
        frequency: New frequency — weekly or quarterly.
    """
    fields = {}
    if title is not None:
        fields["title"] = title
    if description is not None:
        fields["description"] = description
    if kind is not None:
        fields["kind"] = kind
    if status is not None:
        fields["status"] = status
    if frequency is not None:
        fields["frequency"] = frequency
    return await client.update_key_focus(key_focus_id, **fields)


@mcp.tool()
async def delete_key_focus(key_focus_id: int) -> str:
    """Delete a key focus by ID. All associated blockers and task links are also deleted."""
    await client.delete_key_focus(key_focus_id)
    return f"Key focus {key_focus_id} and all its associations have been deleted"


@mcp.tool()
async def add_task_to_key_focus(key_focus_id: int, task_id: int) -> dict:
    """Link a task to a key focus.

    Args:
        key_focus_id: ID of the key focus.
        task_id: ID of the task to link.
    """
    return await client.add_task_to_key_focus(key_focus_id, task_id)


@mcp.tool()
async def remove_task_from_key_focus(key_focus_id: int, task_id: int) -> str:
    """Remove the link between a task and a key focus.

    Args:
        key_focus_id: ID of the key focus.
        task_id: ID of the task to unlink.
    """
    await client.remove_task_from_key_focus(key_focus_id, task_id)
    return f"Task {task_id} removed from key focus {key_focus_id}"


@mcp.tool()
async def list_key_focus_tasks(key_focus_id: int) -> list[dict]:
    """List all tasks associated with a key focus."""
    return await client.list_key_focus_tasks(key_focus_id)
