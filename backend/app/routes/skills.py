from fastapi import APIRouter

from app.services import agent_registry

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("")
def list_skills():
    """List JARVIS-published skills from the GCP Agent Registry."""
    return agent_registry.list_skills()
