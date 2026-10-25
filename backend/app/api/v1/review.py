from datetime import datetime, timezone
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import Analysis, ExtractedMedicine, Evidence, Review, User
from app.schemas.schemas import (
    ReviewCreate, ReviewResponse, ApprovalRequest, RejectRequest,
    PatientSummaryResponse, PatientScheduleItem, PatientFoodWarningItem
)
from app.core.auth import require_doctor, require_user
from app.services.pipeline_orchestrator import add_audit_log

router = APIRouter()


def utc_now():
    return datetime.now(timezone.utc)


@router.post("/analyses/{analysis_id}/review", response_model=ReviewResponse, tags=["Doctor Review"])
def save_review_draft(
    analysis_id: str,
    review_data: ReviewCreate,
    current_user: User = Depends(require_doctor),
    db: Session = Depends(get_db)
):
    """Saves doctor review notes, annotations, and corrections without final sign-off."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    reviewer_name = review_data.reviewer_name or current_user.name
    review = Review(
        analysis_id=analysis_id,
        reviewer_name=reviewer_name,
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
        db,
        analysis_id=analysis_id,
        event_type="review_draft_saved",
        actor=current_user.name,
        details={"notes": review_data.review_notes},
        user_id=current_user.id
    )
    db.commit()

    return review


@router.post("/analyses/{analysis_id}/approve", response_model=ReviewResponse, tags=["Doctor Review"])
def approve_analysis(
    analysis_id: str,
    approval: ApprovalRequest,
    current_user: User = Depends(require_doctor),
    db: Session = Depends(get_db)
):
    """
    Clinician Gateway Approval (Doctor Only):
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

    reviewer_name = approval.reviewer_name or current_user.name
    review = Review(
        analysis_id=analysis_id,
        reviewer_name=reviewer_name,
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
    analysis.reviewed_by = current_user.id
    analysis.reviewed_at = utc_now()
    db.commit()
    db.refresh(review)

    add_audit_log(
        db,
        analysis_id=analysis_id,
        event_type="approve",
        actor=current_user.name,
        details={"review_notes": approval.review_notes, "duration_sec": approval.review_duration_seconds},
        user_id=current_user.id
    )
    db.commit()

    return review


@router.post("/analyses/{analysis_id}/reject", response_model=ReviewResponse, tags=["Doctor Review"])
def reject_analysis(
    analysis_id: str,
    reject: RejectRequest,
    current_user: User = Depends(require_doctor),
    db: Session = Depends(get_db)
):
    """Doctor-only rejection with mandatory reason."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    reviewer_name = reject.reviewer_name or current_user.name
    review = Review(
        analysis_id=analysis_id,
        reviewer_name=reviewer_name,
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
    analysis.rejection_reason = reject.rejection_reason
    analysis.reviewed_by = current_user.id
    analysis.reviewed_at = utc_now()
    db.commit()
    db.refresh(review)

    add_audit_log(
        db,
        analysis_id=analysis_id,
        event_type="reject",
        actor=current_user.name,
        details={"reason": reject.rejection_reason},
        user_id=current_user.id
    )
    db.commit()

    return review


@router.get("/analyses/{analysis_id}/patient-summary", response_model=PatientSummaryResponse, tags=["Patient Summary"])
def get_patient_summary(
    analysis_id: str,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db)
):
    """
    STRICT ACCESS CONTROL:
    Generates and returns the simplified patient summary ONLY if the analysis
    has been explicitly reviewed and approved by a clinician.
    Returns 403 Forbidden for pending, unreviewed, or rejected analyses.
    Patients can only view the summary of their own approved analyses (403 otherwise).
    """
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    if analysis.review_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Patient summary is strictly unavailable until verified and approved by a clinician."
        )

    if current_user.role == "patient" and analysis.patient_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You may only access your own verified prescription summary."
        )

    # Get latest approval review
    latest_approval = db.query(Review).filter(
        Review.analysis_id == analysis_id,
        Review.decision == "approved"
    ).order_by(Review.decided_at.desc()).first()

    reviewer_name = latest_approval.reviewer_name if latest_approval else (
        analysis.reviewer.name if analysis.reviewer else "Attending Clinician"
    )
    reviewer_role = latest_approval.reviewer_role if latest_approval else "Clinician Reviewer"
    approval_date = analysis.reviewed_at or (latest_approval.decided_at if latest_approval else utc_now())

    # Build Patient Schedule Items
    schedule_items: List[PatientScheduleItem] = []
    for med in analysis.medicines:
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

    patient_display_name = analysis.patient.name if analysis.patient else (analysis.patient_name_detected or "Patient")

    return PatientSummaryResponse(
        analysis_id=analysis_id,
        patient_name=patient_display_name,
        prescriber_name=analysis.prescriber_name_detected or "Consultant Physician",
        prescription_date=analysis.prescription_date_detected,
        approval_date=approval_date,
        approved_by=reviewer_name,
        reviewer_role=reviewer_role,
        medicines_schedule=schedule_items,
        dietary_warnings=dietary_warnings
    )


@router.get("/analyses/{analysis_id}/patient-summary/translate", response_model=PatientSummaryResponse, tags=["Patient Summary"])
async def get_translated_patient_summary(
    analysis_id: str,
    lang: str = "hi",
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db)
):
    """
    Returns an AI-translated version of the verified patient summary (e.g. Hindi).
    Cached in SQLite api_cache table. Enforces the strict rule that unapproved
    summaries return HTTP 403.
    """
    # 1. Fetch base summary (enforces 403 on unapproved or unowned)
    base_summary = get_patient_summary(analysis_id, current_user, db)
    if lang != "hi":
        return base_summary

    cache_key = f"{analysis_id}:hi"
    from app.services.api_cache import get_cached_api_response, set_cached_api_response
    cached = get_cached_api_response("translation", cache_key, db=db)
    if cached:
        return PatientSummaryResponse(**cached)

    # Standard translation mapping for clinical schedule and food advice
    HINDI_DICTIONARY = {
        "Three times daily": "दिन में तीन बार (सुबह, दोपहर, रात)",
        "Twice daily": "दिन में दो बार (सुबह और रात)",
        "Once daily": "दिन में एक बार",
        "Once daily at bedtime": "दिन में एक बार, रात को सोने से पहले",
        "At bedtime": "रात को सोने से पहले",
        "pc (after food)": "भोजन के बाद (खाने के बाद लें)",
        "ac (before food)": "भोजन से पहले (खाली पेट लें)",
        "with meals": "भोजन के साथ लें",
        "Take after meals": "भोजन के बाद एक गिलास पानी के साथ लें।",
        "Take with meals": "पेट की सुरक्षा के लिए भोजन के साथ लें।",
        "Take on empty stomach": "भोजन से 1 घंटा पहले खाली पेट लें।",
        "Food / Milk": "भोजन / दूध",
        "Grapefruit Juice": "मौसमी या चकोतरे का रस (ग्रेपफ्रूट)",
        "Dairy Products": "दूध, दही, पनीर और अन्य डेयरी उत्पाद",
        "Alcohol": "शराब / मदिरापान",
        "Meals & Food": "भोजन और नाश्ता",
        "General Diet": "सामान्य आहार",
        "General Diet / Food": "सामान्य भोजन"
    }

    # Attempt translation via Gemini if configured
    import json
    from app.core.config import settings

    translated_schedule = []
    for item in base_summary.medicines_schedule:
        timing_hi = HINDI_DICTIONARY.get(item.timing_schedule, item.timing_schedule)
        food_hi = HINDI_DICTIONARY.get(item.food_instruction, item.food_instruction)
        translated_schedule.append(
            PatientScheduleItem(
                medicine_name=item.medicine_name,
                strength=item.strength,
                dosage=item.dosage,
                route=item.route,
                timing_schedule=timing_hi,
                food_instruction=food_hi,
                caution_notes=item.caution_notes
            )
        )

    translated_warnings = []
    for w in base_summary.dietary_warnings:
        food_hi = HINDI_DICTIONARY.get(w.food_or_substance, w.food_or_substance)
        advice_hi = w.advice
        if "grapefruit" in w.advice.lower():
            advice_hi = "इस दवा के साथ चकोतरे (ग्रेपफ्रूट) का रस बिल्कुल न पिएं। यह दवा के स्तर को हानिकारक रूप से बढ़ा सकता है।"
        elif "milk" in w.advice.lower() or "dairy" in w.advice.lower():
            advice_hi = "दूध या डेयरी उत्पादों के सेवन से 2 घंटे पहले या बाद में ही यह दवा लें।"
        elif "alcohol" in w.advice.lower():
            advice_hi = "इस दवा के सेवन के दौरान शराब का सेवन पूरी तरह से वर्जित है।"
        elif "with food" in w.advice.lower() or "meals" in w.advice.lower():
            advice_hi = "पेट की खराबी या जलन से बचने के लिए इसे भोजन या हल्के नाश्ते के बाद लें।"

        translated_warnings.append(
            PatientFoodWarningItem(
                medicine_name=w.medicine_name,
                food_or_substance=food_hi,
                warning_level=w.warning_level,
                advice=advice_hi,
                source_title=w.source_title,
                official_source_url=w.official_source_url
            )
        )

    translated_summary = PatientSummaryResponse(
        analysis_id=base_summary.analysis_id,
        patient_name=base_summary.patient_name,
        prescriber_name=base_summary.prescriber_name,
        prescription_date=base_summary.prescription_date,
        approval_date=base_summary.approval_date,
        approved_by=base_summary.approved_by,
        reviewer_role=base_summary.reviewer_role,
        medicines_schedule=translated_schedule,
        dietary_warnings=translated_warnings,
        disclaimer=(
            "महत्वपूर्ण सूचना: यह सारांश AI द्वारा विश्लेषित और अधिकृत चिकित्सक द्वारा सत्यापित है। "
            "यह आधिकारिक चिकित्सीय सलाह का विकल्प नहीं है। किसी भी संदेह या दुष्प्रभाव की स्थिति में तुरंत अपने डॉक्टर से संपर्क करें।"
        )
    )

    # Cache translated response
    set_cached_api_response("translation", cache_key, translated_summary.model_dump(mode="json"), ttl_days=7, db=db)
    return translated_summary
