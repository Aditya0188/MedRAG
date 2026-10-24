from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db.session import get_db
from app.models.entities import Analysis, Evidence
from app.schemas.schemas import EvidenceResponse

router = APIRouter()


@router.get("/analyses/{analysis_id}/evidence", response_model=List[EvidenceResponse], tags=["Evidence"])
def get_analysis_evidence(analysis_id: str, db: Session = Depends(get_db)):
    """Retrieve all official drug-food interaction evidence passages linked to this analysis."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return analysis.evidences


@router.get("/evidence/search", response_model=List[EvidenceResponse], tags=["Evidence"])
def search_evidence_library(
    q: Optional[str] = None,
    category: Optional[str] = None,
    provider: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Search the Evidence Library of verified drug-food and drug-drug interactions
    retrieved from official FDA DailyMed and openFDA labeling documents.
    """
    query = db.query(Evidence)

    if q:
        filter_str = f"%{q}%"
        query = query.filter(
            or_(
                Evidence.medicine_name.ilike(filter_str),
                Evidence.food_or_substance.ilike(filter_str),
                Evidence.source_document_title.ilike(filter_str),
                Evidence.evidence_excerpt.ilike(filter_str)
            )
        )
    if category:
        query = query.filter(Evidence.evidence_category == category)
    if provider:
        query = query.filter(Evidence.source_provider == provider)

    return query.order_by(Evidence.retrieval_timestamp.desc()).offset(skip).limit(limit).all()
