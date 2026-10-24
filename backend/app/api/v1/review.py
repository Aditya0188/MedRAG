from datetime import datetime, timezone
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import Analysis, ExtractedMedicine, Evidence, Review
from app.schemas.schemas import (
    ReviewCreate, ReviewResponse, ApprovalRequest, RejectRequest,
    PatientSummaryResponse, PatientScheduleItem, PatientFoodWarningItem
)
from app.services.pipeline_orchestrator import add_audit_log

router = APIRouter()


def utc_now():
    return datetime.now(timezone.utc)


@router.post("/analyses/{analysis_id}/review", response_model=ReviewResponse, tags=["Doctor Review"])
def save_review_draft(
    analysis_id: str,
    review_data: ReviewCreate,
    db: Session = Depends(get_db)
):
    """Saves doctor review notes, annotations, and corrections without final sign-off."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    review = Review(
        analysis_id=analysis_id,
        reviewer_name=review_data.reviewer_name,
        reviewer_role=review_data.reviewer_role,
        decision="in_review",
        review_notes=review_data.review_notes,
        corrections_made_json=review_data.corrections_made,
        review_duration_seconds=review_data.review_duration_seconds,
        decided_at=utc_now()
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    add_audit_log(
        db, analysis_id, "review_draft_saved",
        actor=review_data.reviewer_name,
        details={"notes": review_data.review_notes}
    )
    db.commit()

    return review


@router.post("/analyses/{analysis_id}/approve", response_model=ReviewResponse, tags=["Doctor Review"])
def approve_analysis(
    analysis_id: str,
    approval: ApprovalRequest,
    db: Session = Depends(get_db)
):
    """
    Clinician Gateway Approval:
    Validates that all critical ambiguous fields have been reviewed or resolved.
    Transitions analysis state to 'approved', enabling generation of patient summary.
    """
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    if analysis.review_status == "approved":
        raise HTTPException(status_code=400, detail="This analysis is already approved.")

    # Validation check: Ensure no unreviewed critical ambiguities exist
    for med in analysis.medicines:
        flags = med.uncertainty_flags or []
        if ("unclear_handwriting" in flags or "ambiguous_drug_identity" in flags) and not med.reviewer_corrected:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Approval blocked: Medication '{med.original_name}' has unresolved ambiguous handwriting. "
                    "A clinician must verify or edit this medicine row before giving final approval."
                )
            )

    # Record Review Record
    review = Review(
        analysis_id=analysis_id,
        reviewer_name=approval.reviewer_name,
        reviewer_role=approval.reviewer_role,
        decision="approved",
        review_notes=approval.review_notes,
        corrections_made_json={},
        review_duration_seconds=approval.review_duration_seconds,
        decided_at=utc_now()
    )
    db.add(review)

    # Update Analysis state
    analysis.review_status = "approved"
    analysis.stage = "approved"
    db.commit()
    db.refresh(review)

    add_audit_log(
        db, analysis_id, "doctor_approved",
        actor=approval.reviewer_name,
        details={"review_notes": approval.review_notes, "duration_sec": approval.review_duration_seconds}
    )
    db.commit()

    return review


@router.post("/analyses/{analysis_id}/reject", response_model=ReviewResponse, tags=["Doctor Review"])
def reject_analysis(
    analysis_id: str,
    reject: RejectRequest,
    db: Session = Depends(get_db)
):
    """Doctor rejects the prescription report with reason."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    review = Review(
        analysis_id=analysis_id,
        reviewer_name=reject.reviewer_name,
        reviewer_role=reject.reviewer_role,
        decision="rejected",
        review_notes=reject.rejection_reason,
        corrections_made_json={},
        review_duration_seconds=reject.review_duration_seconds,
        decided_at=utc_now()
    )
    db.add(review)

    analysis.review_status = "rejected"
    analysis.stage = "rejected"
    db.commit()
    db.refresh(review)

    add_audit_log(
        db, analysis_id, "doctor_rejected",
        actor=reject.reviewer_name,
        details={"reason": reject.rejection_reason}
    )
    db.commit()

    return review


@router.get("/analyses/{analysis_id}/patient-summary", response_model=PatientSummaryResponse, tags=["Patient Summary"])
def get_patient_summary(analysis_id: str, db: Session = Depends(get_db)):
    """
    STRICT ACCESS CONTROL:
    Generates and returns the simplified patient summary ONLY if the analysis
    has been explicitly reviewed and approved by a clinician.
    Returns 403 Forbidden for pending or rejected analyses.
    """
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    if analysis.review_status != "approved":
        raise HTTPException(
            status_code=403,
            detail="Access Denied: Patient summary is strictly unavailable until verified and approved by a clinician."
        )

    # Get latest approval review
    latest_approval = db.query(Review).filter(
        Review.analysis_id == analysis_id,
        Review.decision == "approved"
    ).order_by(Review.decided_at.desc()).first()

    reviewer_name = latest_approval.reviewer_name if latest_approval else "Attending Clinician"
    reviewer_role = latest_approval.reviewer_role if latest_approval else "Clinician Reviewer"
    approval_date = latest_approval.decided_at if latest_approval else utc_now()

    # Build Patient Schedule Items
    schedule_items: List[PatientScheduleItem] = []
    for med in analysis.medicines:
        # Standardize timing phrase
        timing_display = med.frequency_meaning or med.frequency or "As directed by physician"
        if med.timing_instructions:
            timing_display += f" ({med.timing_instructions})"

        food_inst = med.food_instructions or "Take with a glass of water."

        schedule_items.append(
            PatientScheduleItem(
                medicine_name=med.normalized_name or med.original_name,
                strength=med.strength or "Standard strength",
                dosage=med.dosage or "1 unit",
                route=med.route or "oral",
                timing_schedule=timing_display,
                food_instruction=food_inst,
                caution_notes=med.reviewer_notes
            )
        )

    # Build Dietary Warnings
    dietary_warnings: List[PatientFoodWarningItem] = []
    category_map = {
        "avoid_contraindicated": "AVOID",
        "limit_caution": "LIMIT",
        "timing_instruction": "TIMING",
        "no_relevant_warning": "SAFE",
        "unavailable_insufficient": "UNKNOWN"
    }

    for ev in analysis.evidences:
        level = category_map.get(ev.evidence_category, "TIMING")
        dietary_warnings.append(
            PatientFoodWarningItem(
                medicine_name=ev.medicine_name,
                food_or_substance=ev.food_or_substance,
                warning_level=level,
                advice=ev.plain_language_summary,
                source_title=ev.source_document_title,
                official_source_url=ev.official_source_url
            )
        )

    return PatientSummaryResponse(
        analysis_id=analysis_id,
        patient_name=analysis.patient_name_detected or "Patient",
        prescriber_name=analysis.prescriber_name_detected or "Consultant Physician",
        prescription_date=analysis.prescription_date_detected,
        approval_date=approval_date,
        approved_by=reviewer_name,
        reviewer_role=reviewer_role,
        medicines_schedule=schedule_items,
        dietary_warnings=dietary_warnings
    )
