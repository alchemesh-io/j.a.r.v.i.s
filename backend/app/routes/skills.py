import logging
import os
import re

from fastapi import APIRouter
from google.cloud import storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/skills", tags=["skills"])

SKILLS_BUCKET = os.getenv("SKILLS_BUCKET", "")

_FRONTMATTER_DESCRIPTION_RE = re.compile(r"^description:\s*(.+)$", re.MULTILINE)

_client: storage.Client | None = None
_client_init_failed = False


def _get_client() -> storage.Client | None:
    """Lazily create the GCS client. Returns None if unconfigured or unreachable."""
    global _client, _client_init_failed
    if _client is not None or _client_init_failed:
        return _client
    try:
        _client = storage.Client()
    except Exception:
        logger.warning("Failed to initialize GCS client for skills bucket %s", SKILLS_BUCKET)
        _client_init_failed = True
    return _client


def _parse_description(text: str) -> str:
    match = _FRONTMATTER_DESCRIPTION_RE.search(text)
    return match.group(1).strip() if match else ""


@router.get("")
def list_skills():
    """List skills (name + version + description) from the skills GCS bucket.

    Layout: gs://<SKILLS_BUCKET>/<name>/<version>/SKILL.md. Returns one entry per
    (name, version) pair, matching the shape the worker/task-board skill pickers expect.
    """
    if not SKILLS_BUCKET:
        return []

    client = _get_client()
    if client is None:
        return []

    try:
        bucket = client.bucket(SKILLS_BUCKET)

        name_iter = client.list_blobs(bucket, delimiter="/")
        list(name_iter)  # exhaust to populate .prefixes
        skill_names = sorted(p.rstrip("/") for p in (name_iter.prefixes or []))

        results = []
        for name in skill_names:
            version_iter = client.list_blobs(bucket, prefix=f"{name}/", delimiter="/")
            list(version_iter)
            versions = sorted(p[len(name) + 1 :].rstrip("/") for p in (version_iter.prefixes or []))
            if not versions:
                continue
            latest_version = "latest" if "latest" in versions else versions[-1]
            for version in versions:
                blob = bucket.blob(f"{name}/{version}/SKILL.md")
                description = ""
                if blob.exists(client):
                    description = _parse_description(blob.download_as_text())
                results.append(
                    {
                        "name": name,
                        "description": description,
                        "version": version,
                        "is_latest": version == latest_version,
                    }
                )
        return results
    except Exception:
        logger.warning("Failed to list skills from GCS bucket %s", SKILLS_BUCKET, exc_info=True)
        return []
