"""JIRA integration tools for J.A.R.V.I.S."""

from typing import Optional

from core.api_client import BackendClient
from core.server import mcp

client = BackendClient()


@mcp.tool()
async def get_jira_config() -> dict:
    """Check if JIRA integration is configured and return the project URL."""
    return await client.get_jira_config()


@mcp.tool()
async def list_jira_tickets() -> list[dict]:
    """List JIRA tickets matching the configured JQL filter.

    Returns tickets not already linked to an active (non-done) task,
    so they can be imported as new tasks.
    """
    return await client.list_jira_tickets()


@mcp.tool()
async def get_jira_ticket(key: str) -> dict:
    """Get details of a specific JIRA ticket by key (e.g. 'AG-22')."""
    return await client.get_jira_ticket(key)
