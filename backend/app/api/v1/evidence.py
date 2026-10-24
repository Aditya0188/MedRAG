from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db.session import get_db
from app.models.entities import Analysis, Evidence
from app.schemas.schemas import EvidenceResponse
from app.services.retrieval.curated_fda_catalog import get_curated_evidence_catalog

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
    limit: int = Query(60, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Search the Evidence Library of verified drug-food and drug-drug interactions
    retrieved from official FDA DailyMed and openFDA labeling documents.
    Blends persisted analysis evidences with the pre-seeded 55+ FDA gold-standard catalog.
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
    if category and category != "all":
        query = query.filter(Evidence.evidence_category == category)
    if provider:
        query = query.filter(Evidence.source_provider == provider)

    db_results = query.order_by(Evidence.retrieval_timestamp.desc()).offset(skip).limit(limit).all()
    results: List[Any] = list(db_results)
    existing_keys = {f"{e.medicine_name.lower()}-{e.food_or_substance.lower()}" for e in results}

    # Supplement with curated FDA catalog so library is populated and responsive even prior to running scans
    catalog = get_curated_evidence_catalog()
    for item in catalog:
        if category and category != "all" and item.get("evidence_category") != category:
            continue
        if provider and provider.lower() not in item.get("source_provider", "").lower():
            continue
        if q:
            query_str = q.lower().strip()
            searchable_text = f"{item.get('medicine_name', '')} {item.get('food_or_substance', '')} {item.get('evidence_excerpt', '')} {item.get('plain_language_summary', '')}".lower()
            if query_str not in searchable_text:
                continue

        key = f"{item.get('medicine_name', '').lower()}-{item.get('food_or_substance', '').lower()}"
        if key not in existing_keys:
            existing_keys.add(key)
            results.append(
                EvidenceResponse(
                    id=item["id"],
                    analysis_id="global_catalog",
                    medicine_id=None,
                    medicine_name=item["medicine_name"],
                    food_or_substance=item["food_or_substance"],
                    evidence_category=item["evidence_category"],
                    source_provider=item["source_provider"],
                    source_document_title=item["source_document_title"],
                    source_section=item.get("source_section"),
                    official_source_url=item["official_source_url"],
                    evidence_excerpt=item["evidence_excerpt"],
                    plain_language_summary=item["plain_language_summary"],
                    retrieval_score=item.get("retrieval_score", 0.95),
                    retrieval_timestamp=datetime.now(timezone.utc),
                    retrieval_metadata=item.get("retrieval_metadata", {})
                )
            )
            if len(results) >= limit:
                break

    return results[:limit]
