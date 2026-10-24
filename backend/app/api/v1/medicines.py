from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import Analysis, ExtractedMedicine
from app.schemas.schemas import ExtractedMedicineResponse, ExtractedMedicineUpdate
from app.services.rxnorm.rxnorm_client import verify_medicine_terminology
from app.services.pipeline_orchestrator import add_audit_log

router = APIRouter()


@router.get("/analyses/{analysis_id}/medicines", response_model=List[ExtractedMedicineResponse], tags=["Medicines"])
def get_medicines(analysis_id: str, db: Session = Depends(get_db)):
    """Retrieve all extracted medicine items for an analysis."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return analysis.medicines


@router.patch("/analyses/{analysis_id}/medicines/{medicine_id}", response_model=ExtractedMedicineResponse, tags=["Medicines"])
def update_medicine(
    analysis_id: str,
    medicine_id: str,
    update_data: ExtractedMedicineUpdate,
    db: Session = Depends(get_db)
):
    """
    Row-level editing control for authorized clinicians to correct extracted medicine details.
    Persists changes, sets reviewer_corrected=True, and logs audit event.
    """
    med = db.query(ExtractedMedicine).filter(
        ExtractedMedicine.id == medicine_id,
        ExtractedMedicine.analysis_id == analysis_id
    ).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicine record not found.")

    patch_dict = update_data.model_dump(exclude_unset=True)
    if not patch_dict:
        return med

    # Apply updates
    for field, val in patch_dict.items():
        setattr(med, field, val)

    med.reviewer_corrected = True
    
    # If original_name or normalized_name changed, clear uncertainty flag for unclear_handwriting
    if "normalized_name" in patch_dict or "original_name" in patch_dict:
        flags = [f for f in (med.uncertainty_flags or []) if f not in ["unclear_handwriting", "ambiguous_drug_identity"]]
        med.uncertainty_flags = flags

    db.commit()
    db.refresh(med)

    add_audit_log(
        db, analysis_id, "medicine_corrected_by_doctor",
        actor="clinician_reviewer",
        details={"medicine_id": medicine_id, "updated_fields": list(patch_dict.keys())}
    )
    db.commit()

    return med


@router.post("/analyses/{analysis_id}/verify-medicines", response_model=List[ExtractedMedicineResponse], tags=["Medicines"])
async def reverify_medicines(analysis_id: str, db: Session = Depends(get_db)):
    """Re-runs RxNorm terminology verification on all medicines in this analysis."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    for med in analysis.medicines:
        search_term = med.normalized_name or med.original_name
        res = await verify_medicine_terminology(search_term, med.strength)
        if res.normalized_name:
            med.normalized_name = res.normalized_name
            med.rxcui = res.rxcui
            med.concept_type = res.concept_type
            med.verification_status = res.verification_status
            med.alternatives_json = [c.model_dump() for c in res.candidates]

    db.commit()
    add_audit_log(db, analysis_id, "medicines_reverified", actor="clinician_reviewer")
    db.commit()

    return analysis.medicines
