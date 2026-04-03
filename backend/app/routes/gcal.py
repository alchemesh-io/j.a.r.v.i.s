import datetime
import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from googleapiclient.errors import HttpError

from app.config import settings

logger = logging.getLogger(__name__)
from app.services.gcal_client import CalendarGroup, GCalClient

router = APIRouter(prefix="/gcal", tags=["gcal"])

# Module-level client instance to persist OAuth2 tokens in-memory
_gcal_client: GCalClient | None = None


def _get_client() -> GCalClient:
    global _gcal_client
    if _gcal_client is None:
        _gcal_client = GCalClient(config=settings.gcal)
    return _gcal_client


def _require_configured() -> None:
    if not settings.gcal.configured:
        raise HTTPException(status_code=503, detail="Google Calendar integration is not configured")


@router.get("/auth/status")
def get_auth_status():
    gcal = settings.gcal
    logger.info(
        "GCal auth status check — auth_mode=%s, client_id=%s, client_secret=%s, redirect_uri=%s, configured=%s",
        gcal.auth_mode,
        bool(gcal.client_id),
        bool(gcal.client_secret),
        bool(gcal.redirect_uri),
        gcal.configured,
    )
    if not gcal.configured:
        return {"configured": False, "authenticated": False, "mode": None}

    client = _get_client()
    return {
        "configured": True,
        "authenticated": client.is_authenticated(),
        "mode": gcal.auth_mode,
    }


@router.get("/auth/debug")
def get_auth_debug():
    gcal = settings.gcal
    return {
        "auth_mode": gcal.auth_mode,
        "has_client_id": bool(gcal.client_id),
        "has_client_secret": bool(gcal.client_secret),
        "has_redirect_uri": bool(gcal.redirect_uri),
        "redirect_uri": gcal.redirect_uri,
        "has_project_id": bool(gcal.project_id),
        "has_auth_uri": bool(gcal.auth_uri),
        "has_token_uri": bool(gcal.token_uri),
        "configured": gcal.configured,
    }


@router.get("/auth/login")
def auth_login():
    _require_configured()
    gcal = settings.gcal
    if gcal.auth_mode != "oauth2":
        raise HTTPException(status_code=400, detail="OAuth2 login not available in service_account mode")

    client = _get_client()
    url = client.get_auth_url()
    return RedirectResponse(url=url)


@router.get("/auth/callback")
def auth_callback(code: str = Query(None), error: str = Query(None)):
    _require_configured()

    if error or not code:
        return RedirectResponse(url="/?gcal_error=auth_failed")

    client = _get_client()
    try:
        client.handle_callback(code)
    except Exception as exc:
        logger.exception("Google OAuth2 token exchange failed")
        from urllib.parse import quote
        return RedirectResponse(url=f"/?gcal_error=token_exchange_failed&detail={quote(str(exc))}")

    return RedirectResponse(url="/?gcal_auth=success")


@router.get("/events", response_model=list[CalendarGroup])
def list_events(
    date: datetime.date = Query(...),
    view: str = Query("daily", pattern="^(daily|weekly)$"),
):
    _require_configured()

    client = _get_client()
    if not client.is_authenticated():
        raise HTTPException(status_code=401, detail="Google Calendar authentication required")

    try:
        return client.list_events(date=date, view=view)
    except HttpError as exc:
        raise HTTPException(status_code=502, detail=f"Google Calendar API error: {exc.reason}") from exc
