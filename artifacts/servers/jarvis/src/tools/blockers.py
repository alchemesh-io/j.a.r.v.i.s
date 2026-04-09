"""Blocker management tools for J.A.R.V.I.S."""

from typing import Optional

from core.api_client import BackendClient
from core.server import mcp

client = BackendClient()


@mcp.tool()
async def create_blocker(
    title: str,
    task_id: Optional[int] = None,
    key_focus_id: Optional[int] = None,
    description: Optional[str] = None,
) -> dict:
    """Create a new blocker. Must be linked to exactly one of task_id or key_focus_id.

    Args:
        title: Blocker title.
        task_id: ID of the task to block (mutually exclusive with key_focus_id).
        key_focus_id: ID of the key focus to block (mutually exclusive with task_id).
        description: Optional description.
    """
    return await client.create_blocker(
        title=title,
        task_id=task_id,
        key_focus_id=key_focus_id,
        description=description,
    )


@mcp.tool()
async def get_blocker(blocker_id: int) -> dict:
    """Get a single blocker by ID."""
    return await client.get_blocker(blocker_id)


@mcp.tool()
async def list_blockers(status: Optional[str] = None) -> list[dict]:
    """List all blockers with optional status filtering.

    Args:
        status: Filter by status — opened or resolved.
    """
    return await client.list_blockers(status=status)


@mcp.tool()
async def update_blocker(
    blocker_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
) -> dict:
    """Update a blocker's fields. Only provided fields are changed.

    Args:
        blocker_id: ID of the blocker to update.
        title: New title.
        description: New description.
        status: New status — opened or resolved.
    """
    fields = {}
    if title is not None:
        fields["title"] = title
    if description is not None:
        fields["description"] = description
    if status is not None:
        fields["status"] = status
    return await client.update_blocker(blocker_id, **fields)


@mcp.tool()
async def delete_blocker(blocker_id: int) -> str:
    """Delete a blocker by ID."""
    await client.delete_blocker(blocker_id)
    return f"Blocker {blocker_id} has been deleted"
