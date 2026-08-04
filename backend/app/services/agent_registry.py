import logging
import os

import google.auth
import httpx
from google.auth.transport.requests import Request

logger = logging.getLogger(__name__)

AGENT_REGISTRY_HOST = os.getenv("AGENT_REGISTRY_HOST", "agentregistry.googleapis.com")
AGENT_REGISTRY_PROJECT = os.getenv("AGENT_REGISTRY_PROJECT", "")
AGENT_REGISTRY_LOCATION = os.getenv("AGENT_REGISTRY_LOCATION", "global")

_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]


def _access_token() -> str:
    credentials, _ = google.auth.default(scopes=_SCOPES)
    credentials.refresh(Request())
    return credentials.token


def _base_url() -> str:
    return (
        f"https://{AGENT_REGISTRY_HOST}/v1alpha/projects/{AGENT_REGISTRY_PROJECT}"
        f"/locations/{AGENT_REGISTRY_LOCATION}"
    )


def list_skills() -> list[dict]:
    """List JARVIS-published skills from the GCP Agent Registry.

    The project-level skills list also includes platform/vendor-published skills
    (e.g. Gemini Enterprise connectors) — those carry a `publisher` field, so we
    filter to skills without one to get only the ones published from
    artifacts/skills/. The list endpoint doesn't return `frontmatter`, only
    `displayName` and a top-level `description` (frontmatter is only present on
    single-resource GETs).

    Returns [] on any configuration or transport error rather than raising, so the
    dashboard/skill-picker callers degrade gracefully instead of 500ing.
    """
    if not AGENT_REGISTRY_PROJECT:
        logger.warning("AGENT_REGISTRY_PROJECT is not configured, skipping skills listing")
        return []

    try:
        token = _access_token()
        resp = httpx.get(
            f"{_base_url()}/skills",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5.0,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        logger.warning("Failed to list skills from the Agent Registry", exc_info=True)
        return []

    skills = data.get("skills", [])
    return [
        {
            "name": skill.get("displayName", ""),
            "description": skill.get("description", ""),
            "version": skill.get("defaultRevision", "").rsplit("/", 1)[-1] or "latest",
            "is_latest": True,
        }
        for skill in skills
        if "publisher" not in skill
    ]
