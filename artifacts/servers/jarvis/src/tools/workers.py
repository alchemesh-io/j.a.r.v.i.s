"""Worker management tools for J.A.R.V.I.S."""

from typing import Optional

from core.api_client import BackendClient
from core.server import mcp

client = BackendClient()


@mcp.tool()
async def create_worker(
    task_id: int,
    repository_ids: Optional[list[int]] = None,
    type: str = "claude_code",
) -> dict:
    """Create a new worker for a task.

    Args:
        task_id: ID of the task to attach the worker to.
        repository_ids: Optional list of repository IDs to clone into the worker.
        type: Worker type — currently only 'claude_code'.
    """
    return await client.create_worker(
        task_id=task_id, repository_ids=repository_ids, type=type
    )


@mcp.tool()
async def list_workers() -> list[dict]:
    """List all workers with their task associations and repositories."""
    return await client.list_workers()


@mcp.tool()
async def get_worker(worker_id: str) -> dict:
    """Get a worker by ID, including effective state from live pod status.

    Args:
        worker_id: The 32-character hex worker ID.
    """
    return await client.get_worker(worker_id)


@mcp.tool()
async def update_worker(
    worker_id: str,
    state: Optional[str] = None,
) -> dict:
    """Update a worker's state.

    Args:
        worker_id: The 32-character hex worker ID.
        state: New state — initialized, working, waiting_for_human, done, or archived.
               Setting to 'archived' will delete the worker's Kubernetes resources.
    """
    fields = {}
    if state is not None:
        fields["state"] = state
    return await client.update_worker(worker_id, **fields)


@mcp.tool()
async def delete_worker(worker_id: str) -> str:
    """Delete a worker and its Kubernetes resources (pod, service).

    Args:
        worker_id: The 32-character hex worker ID.
    """
    await client.delete_worker(worker_id)
    return f"Worker {worker_id} and its Kubernetes resources have been deleted"
