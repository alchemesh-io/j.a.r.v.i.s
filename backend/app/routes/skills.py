import logging
import os

import httpx
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/skills", tags=["skills"])

JAAR_URL = os.getenv("JAAR_URL", "http://jaar-agentregistry.jaar.svc:12121")


@router.get("")
def list_skills():
    """List skills from the Agent Registry (JAAR)."""
    try:
        resp = httpx.get(f"{JAAR_URL}/v0/skills", timeout=5.0)
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError:
        logger.warning("Failed to fetch skills from JAAR at %s", JAAR_URL)
        return []

    return [
        {
            "name": item["skill"]["name"],
            "description": item["skill"].get("description", ""),
            "version": item["skill"].get("version", "latest"),
        }
        for item in data
        if "skill" in item
    ]
