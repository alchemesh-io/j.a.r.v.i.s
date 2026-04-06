"""Weekly planning tools for J.A.R.V.I.S."""

from core.api_client import BackendClient
from core.server import mcp

client = BackendClient()


@mcp.tool()
async def create_weekly(week_start: str) -> dict:
    """Create a weekly planning entry.

    Args:
        week_start: Start date of the week (YYYY-MM-DD, should be a Sunday).
    """
    return await client.create_weekly(week_start=week_start)


@mcp.tool()
async def list_weeklies() -> list[dict]:
    """List all weekly planning entries with their dailies."""
    return await client.list_weeklies()


@mcp.tool()
async def get_weekly(weekly_id: int) -> dict:
    """Get a weekly planning entry by ID, including its dailies."""
    return await client.get_weekly(weekly_id)
