from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.db.session import get_db
from app.models.entities import User, PatientProfile, Analysis, ExtractedMedicine
from app.schemas.schemas import (
    PatientProfileResponse,
    PatientProfileUpdate,
    PatientListItemResponse,
    AnalysisListItem
)
from app.core.auth import require_doctor, require_user, require_patient

router = APIRouter(tags=["Patients"])


@router.get("/patients/me", response_model=PatientProfileResponse)
def get_my_patient_profile(
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db)
):
    """Retrieves the profile (allergies, conditions, notes) of the currently authenticated patient."""
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not profile:
        # Create empty profile if not yet created
        profile = PatientProfile(
            user_id=current_user.id,
            allergies=[],
            conditions=[],
            notes=""
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.put("/patients/me", response_model=PatientProfileResponse)
def update_my_patient_profile(
    profile_data: PatientProfileUpdate,
    current_user: User = Depends(require_patient),
    db: Session = Depends(get_db)
):
    """Allows a patient to update their own allergies, conditions, and health notes."""
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not profile:
        profile = PatientProfile(user_id=current_user.id)
        db.add(profile)

    update_dict = profile_data.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(profile, field, val)

    db.commit()
    db.refresh(profile)
    return profile


@router.get("/patients", response_model=List[PatientListItemResponse])
def list_patients(
    search: Optional[str] = None,
    current_user: User = Depends(require_doctor),
    db: Session = Depends(get_db)
):
    """Doctor-only endpoint: lists all registered patients with their clinical profiles and prescription counts."""
    query = db.query(User).filter(User.role == "patient")
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(User.name.ilike(s) | User.email.ilike(s))

    patients = query.order_by(User.name).all()
    result = []
    for p in patients:
        profile = p.patient_profile
        rx_count = db.query(Analysis).filter(Analysis.patient_id == p.id).count()
        result.append(
            PatientListItemResponse(
                id=p.id,
                name=p.name,
                email=p.email,
                role=p.role,
                created_at=p.created_at,
                age=profile.age if profile else None,
                sex=profile.sex if profile else None,
                allergies=profile.allergies if profile else [],
                conditions=profile.conditions if profile else [],
                prescriptions_count=rx_count
            )
        )
    return result


@router.get("/patients/{patient_id}")
def get_patient_details(
    patient_id: str,
    current_user: User = Depends(require_doctor),
    db: Session = Depends(get_db)
):
    """Doctor-only endpoint: returns full patient card with profile and complete prescription history."""
    patient = db.query(User).filter(User.id == patient_id, User.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient record not found.")

    analyses = db.query(Analysis).filter(Analysis.patient_id == patient.id).order_by(desc(Analysis.created_at)).all()
    history = []
    for a in analyses:
        med_count = db.query(ExtractedMedicine).filter(ExtractedMedicine.analysis_id == a.id).count()
        history.append({
            "id": a.id,
            "original_filename": a.original_filename,
            "created_at": a.created_at,
            "stage": a.stage,
            "status": a.status,
            "review_status": a.review_status,
            "medicine_count": med_count,
            "total_processing_duration_sec": a.total_processing_duration_sec,
            "rejection_reason": a.rejection_reason,
            "has_approved_summary": a.review_status == "approved"
        })

    profile = patient.patient_profile
    return {
        "id": patient.id,
        "name": patient.name,
        "email": patient.email,
        "role": patient.role,
        "created_at": patient.created_at,
        "profile": {
            "age": profile.age if profile else None,
            "sex": profile.sex if profile else None,
            "allergies": profile.allergies if profile else [],
            "conditions": profile.conditions if profile else [],
            "notes": profile.notes if profile else ""
        },
        "prescriptions": history
    }
