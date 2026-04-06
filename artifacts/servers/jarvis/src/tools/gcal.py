"""Google Calendar integration tools for J.A.R.V.I.S."""

from core.api_client import BackendClient
from core.server import mcp

client = BackendClient()


@mcp.tool()
async def get_gcal_auth_status() -> dict:
    """Check Google Calendar authentication status.

    Returns whether the integration is configured, authenticated,
    the auth mode (oauth2 or service_account), and the calendar email.
    """
    return await client.get_gcal_auth_status()


@mcp.tool()
async def get_gcal_event(event_id: str) -> dict:
    """Get details of a specific Google Calendar event by ID."""
    return await client.get_gcal_event(event_id)


@mcp.tool()
async def list_gcal_events(date: str, view: str = "daily") -> list[dict]:
    """List Google Calendar events for a given date.

    Args:
        date: Date in YYYY-MM-DD format.
        view: 'daily' for a single day or 'weekly' for the full week.

    Returns events grouped by calendar, each with summary, start/end times,
    attendees, and attachments.
    """
    return await client.list_gcal_events(date=date, view=view)
