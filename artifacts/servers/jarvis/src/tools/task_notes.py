"""Task note management tools for J.A.R.V.I.S."""

from core.api_client import BackendClient
from core.server import mcp

client = BackendClient()


@mcp.tool()
async def create_task_note(task_id: int, content: str) -> dict:
    """Create a new note on a task.

    Args:
        task_id: ID of the task to add the note to.
        content: Markdown content of the note.
    """
    return await client.create_task_note(task_id, content)


@mcp.tool()
async def list_task_notes(task_id: int) -> list[dict]:
    """List all notes for a task, ordered by most recent first.

    Args:
        task_id: ID of the task whose notes to list.
    """
    return await client.list_task_notes(task_id)


@mcp.tool()
async def update_task_note(task_id: int, note_id: int, content: str) -> dict:
    """Update the content of a task note.

    Args:
        task_id: ID of the parent task.
        note_id: ID of the note to update.
        content: New markdown content.
    """
    return await client.update_task_note(task_id, note_id, content)


@mcp.tool()
async def delete_task_note(task_id: int, note_id: int) -> str:
    """Delete a note from a task.

    Args:
        task_id: ID of the parent task.
        note_id: ID of the note to delete.
    """
    await client.delete_task_note(task_id, note_id)
    return f"Note {note_id} deleted from task {task_id}"
