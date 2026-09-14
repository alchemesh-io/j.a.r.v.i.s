from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.key_focus import KeyFocus
from app.models.opportunity import Opportunity
from app.models.opportunity_key_focus import OpportunityKeyFocus
from app.schemas.opportunity import (
    OpportunityCreate,
    OpportunityKeyFocusCreate,
    OpportunityKeyFocusResponse,
    OpportunityResponse,
    OpportunityUpdate,
)

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


def _opp_to_response(opp: Opportunity) -> OpportunityResponse:
    return OpportunityResponse(
        id=opp.id,
        title=opp.title,
        description=opp.description,
        key_focus_ids=[kf.id for kf in opp.key_focuses],
        key_focus_count=opp.key_focus_count,
        task_count=opp.task_count,
    )


def _load_opportunity(db: Session, opportunity_id: int) -> Opportunity:
    stmt = (
        select(Opportunity)
        .where(Opportunity.id == opportunity_id)
        .options(selectinload(Opportunity.key_focuses).selectinload(KeyFocus.tasks))
    )
    opp = db.scalars(stmt).first()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return opp


@router.post("", response_model=OpportunityResponse, status_code=201)
def create_opportunity(body: OpportunityCreate, db: Session = Depends(get_db)):
    opp = Opportunity(**body.model_dump())
    db.add(opp)
    db.flush()
    db.refresh(opp)
    return _opp_to_response(opp)


@router.get("", response_model=list[OpportunityResponse])
def list_opportunities(db: Session = Depends(get_db)):
    stmt = select(Opportunity).options(
        selectinload(Opportunity.key_focuses).selectinload(KeyFocus.tasks)
    )
    opportunities = db.scalars(stmt).unique().all()
    return [_opp_to_response(o) for o in opportunities]


@router.get("/{opportunity_id}", response_model=OpportunityResponse)
def get_opportunity(opportunity_id: int, db: Session = Depends(get_db)):
    return _opp_to_response(_load_opportunity(db, opportunity_id))


@router.patch("/{opportunity_id}", response_model=OpportunityResponse)
def update_opportunity(
    opportunity_id: int, body: OpportunityUpdate, db: Session = Depends(get_db)
):
    opp = _load_opportunity(db, opportunity_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(opp, field, value)
    db.flush()
    db.refresh(opp)
    return _opp_to_response(opp)


@router.delete("/{opportunity_id}", status_code=204)
def delete_opportunity(opportunity_id: int, db: Session = Depends(get_db)):
    opp = _load_opportunity(db, opportunity_id)
    db.delete(opp)


# --- Key focus association endpoints ---


@router.post(
    "/{opportunity_id}/key-focuses",
    response_model=OpportunityKeyFocusResponse,
    status_code=201,
)
def add_key_focus_to_opportunity(
    opportunity_id: int, body: OpportunityKeyFocusCreate, db: Session = Depends(get_db)
):
    opp = _load_opportunity(db, opportunity_id)
    kf = db.get(KeyFocus, body.key_focus_id)
    if not kf:
        raise HTTPException(status_code=404, detail="Key focus not found")
    existing = db.get(OpportunityKeyFocus, (opp.id, body.key_focus_id))
    if existing:
        raise HTTPException(status_code=409, detail="Association already exists")
    assoc = OpportunityKeyFocus(opportunity_id=opp.id, key_focus_id=kf.id)
    db.add(assoc)
    db.flush()
    return assoc


@router.get("/{opportunity_id}/key-focuses")
def list_opportunity_key_focuses(opportunity_id: int, db: Session = Depends(get_db)):
    opp = _load_opportunity(db, opportunity_id)
    return opp.key_focuses


@router.delete("/{opportunity_id}/key-focuses/{key_focus_id}", status_code=204)
def remove_key_focus_from_opportunity(
    opportunity_id: int, key_focus_id: int, db: Session = Depends(get_db)
):
    assoc = db.get(OpportunityKeyFocus, (opportunity_id, key_focus_id))
    if not assoc:
        raise HTTPException(status_code=404, detail="Association not found")
    db.delete(assoc)
