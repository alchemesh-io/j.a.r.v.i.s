"""Weekly planning tools for J.A.R.V.I.S."""

from core.api_client import BackendClient
from core.server import mcp

client = BackendClient()


@mcp.tool()
async def list_weekly_tasks(date: str) -> list[dict]:
    """List all tasks for the week containing the given date."""
    return await client.list_weekly_tasks(date=date)
