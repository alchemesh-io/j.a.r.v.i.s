"""Repository management tools for J.A.R.V.I.S."""

from core.api_client import BackendClient
from core.server import mcp

client = BackendClient()


@mcp.tool()
async def create_repository(
    git_url: str,
    branch: str = "main",
) -> dict:
    """Create a new repository record.

    Args:
        git_url: The git clone URL (e.g. https://github.com/org/repo).
        branch: The branch name (defaults to 'main').
    """
    return await client.create_repository(git_url=git_url, branch=branch)


@mcp.tool()
async def list_repositories() -> list[dict]:
    """List all registered repositories."""
    return await client.list_repositories()


@mcp.tool()
async def delete_repository(repository_id: int) -> str:
    """Delete a repository. Fails if it's in use by an active worker.

    Args:
        repository_id: ID of the repository to delete.
    """
    await client.delete_repository(repository_id)
    return f"Repository {repository_id} has been deleted"
