"""Scheduled task management tools for J.A.R.V.I.S."""

from typing import Optional

from core.api_client import BackendClient
from core.server import mcp

client = BackendClient()


@mcp.tool()
async def create_scheduled_task(
    title: str,
    task_type: str,
    cron_expression: str,
    note_content: Optional[str] = None,
    status: str = "active",
    repository_ids: Optional[list[int]] = None,
    skills: Optional[list[dict]] = None,
    worker_type: str = "claude_code",
    worker_mode: str = "ephemeral",
    worker_session_mode: str = "auto",
    worker_cpu_request: Optional[str] = None,
    worker_memory_request: Optional[str] = None,
    worker_cpu_limit: Optional[str] = None,
    worker_memory_limit: Optional[str] = None,
) -> dict:
    """Create a new scheduled task that spawns a Task + Worker on a cron schedule.

    Args:
        title: Title given to each Task created when this schedule fires.
        task_type: Task type — refinement, implementation, or review.
        cron_expression: Standard 5-field cron expression (e.g. "0 20 * * 1,4,5").
        note_content: Optional note content attached to each spawned Task.
        status: 'active' (runs on schedule) or 'paused' (never fires automatically).
        repository_ids: Optional list of repository IDs cloned into each spawned worker.
        skills: Optional list of {"name": ..., "version": ...} skill refs.
        worker_type: Worker type — currently only 'claude_code'.
        worker_mode: Worker mode — 'ephemeral' or 'stateful'.
        worker_session_mode: Claude Code permission mode — auto, plan, manual, or edit.
        worker_cpu_request: Optional CPU request override (e.g. "500m").
        worker_memory_request: Optional memory request override (e.g. "512Mi").
        worker_cpu_limit: Optional CPU limit override.
        worker_memory_limit: Optional memory limit override.
    """
    return await client.create_scheduled_task(
        title=title,
        task_type=task_type,
        cron_expression=cron_expression,
        note_content=note_content,
        status=status,
        repository_ids=repository_ids,
        skills=skills,
        worker_type=worker_type,
        worker_mode=worker_mode,
        worker_session_mode=worker_session_mode,
        worker_cpu_request=worker_cpu_request,
        worker_memory_request=worker_memory_request,
        worker_cpu_limit=worker_cpu_limit,
        worker_memory_limit=worker_memory_limit,
    )


@mcp.tool()
async def get_scheduled_task(scheduled_task_id: int) -> dict:
    """Get a scheduled task by ID.

    Args:
        scheduled_task_id: The scheduled task's ID.
    """
    return await client.get_scheduled_task(scheduled_task_id)


@mcp.tool()
async def list_scheduled_tasks() -> list[dict]:
    """List all scheduled tasks with their repositories, skills, and next run time."""
    return await client.list_scheduled_tasks()


@mcp.tool()
async def update_scheduled_task(
    scheduled_task_id: int,
    title: Optional[str] = None,
    task_type: Optional[str] = None,
    cron_expression: Optional[str] = None,
    note_content: Optional[str] = None,
    status: Optional[str] = None,
    repository_ids: Optional[list[int]] = None,
    skills: Optional[list[dict]] = None,
    worker_type: Optional[str] = None,
    worker_mode: Optional[str] = None,
    worker_session_mode: Optional[str] = None,
    worker_cpu_request: Optional[str] = None,
    worker_memory_request: Optional[str] = None,
    worker_cpu_limit: Optional[str] = None,
    worker_memory_limit: Optional[str] = None,
) -> dict:
    """Update a scheduled task. Only the provided fields are changed.

    Args:
        scheduled_task_id: The scheduled task's ID.
        title: New title for spawned Tasks.
        task_type: New task type — refinement, implementation, or review.
        cron_expression: New cron expression; recomputes the next run time.
        note_content: New note content attached to spawned Tasks.
        status: 'active' or 'paused' — pausing clears the next run time.
        repository_ids: New list of repository IDs (replaces the existing set).
        skills: New list of skill refs (replaces the existing set).
        worker_type: New worker type.
        worker_mode: New worker mode — 'ephemeral' or 'stateful'.
        worker_session_mode: New Claude Code permission mode.
        worker_cpu_request: New CPU request override.
        worker_memory_request: New memory request override.
        worker_cpu_limit: New CPU limit override.
        worker_memory_limit: New memory limit override.
    """
    fields = {
        k: v
        for k, v in {
            "title": title,
            "task_type": task_type,
            "cron_expression": cron_expression,
            "note_content": note_content,
            "status": status,
            "repository_ids": repository_ids,
            "skills": skills,
            "worker_type": worker_type,
            "worker_mode": worker_mode,
            "worker_session_mode": worker_session_mode,
            "worker_cpu_request": worker_cpu_request,
            "worker_memory_request": worker_memory_request,
            "worker_cpu_limit": worker_cpu_limit,
            "worker_memory_limit": worker_memory_limit,
        }.items()
        if v is not None
    }
    return await client.update_scheduled_task(scheduled_task_id, **fields)


@mcp.tool()
async def delete_scheduled_task(scheduled_task_id: int) -> str:
    """Delete a scheduled task. Does not affect Tasks/Workers it already spawned.

    Args:
        scheduled_task_id: The scheduled task's ID.
    """
    await client.delete_scheduled_task(scheduled_task_id)
    return f"Scheduled task {scheduled_task_id} has been deleted"


@mcp.tool()
async def run_scheduled_task_now(scheduled_task_id: int) -> dict:
    """Immediately fire a scheduled task, regardless of its cron schedule or
    active/paused status. Creates a Task (+ note) and Worker from its
    definition, then advances last_run_at/next_run_at as if it had fired
    normally.

    Args:
        scheduled_task_id: The scheduled task's ID.
    """
    return await client.run_scheduled_task_now(scheduled_task_id)
