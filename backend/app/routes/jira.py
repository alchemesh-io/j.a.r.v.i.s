from fastapi import APIRouter, Depends, HTTPException, Query
from jira import JIRAError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db
from app.models.enums import SourceType, TaskStatus
from app.models.task import Task
from app.services.jira_client import JiraClient, JiraTicket

router = APIRouter(prefix="/jira", tags=["jira"])


def _require_configured() -> None:
    if not settings.jira.configured:
        raise HTTPException(status_code=503, detail="JIRA integration is not configured")


@router.get("/config")
def get_jira_config():
    jira = settings.jira
    return {
        "configured": jira.configured,
        "projectUrl": jira.project_url if jira.configured else None,
    }


@router.get("/ticket", response_model=JiraTicket)
def get_jira_ticket(key: str = Query(...)):
    _require_configured()
    client = JiraClient(config=settings.jira)
    try:
        return client.get_ticket(key)
    except JIRAError as exc:
        raise HTTPException(status_code=502, detail=f"JIRA API error: {exc.text}") from exc


@router.get("/tickets", response_model=list[JiraTicket])
def list_jira_tickets(db: Session = Depends(get_db)):
    _require_configured()

    client = JiraClient(config=settings.jira)
    try:
        tickets = client.search_tickets()
    except JIRAError as exc:
        raise HTTPException(status_code=502, detail=f"JIRA API error: {exc.text}") from exc

    # Filter out tickets already linked to a non-done task
    stmt = select(Task.source_id).where(
        Task.source_type == SourceType.jira,
        Task.source_id.is_not(None),
        Task.status != TaskStatus.done,
    )
    existing_keys = set(db.scalars(stmt).all())

    return [t for t in tickets if t.key not in existing_keys]
