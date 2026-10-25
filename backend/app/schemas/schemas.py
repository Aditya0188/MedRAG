from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


# -------------------------------------------------------------
# Auth & User Schemas
# -------------------------------------------------------------
class PatientProfileBase(BaseModel):
    age: Optional[int] = None
    sex: Optional[str] = None
    allergies: List[str] = Field(default_factory=list)
    conditions: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class PatientProfileUpdate(BaseModel):
    age: Optional[int] = None
    sex: Optional[str] = None
    allergies: Optional[List[str]] = None
    conditions: Optional[List[str]] = None
    notes: Optional[str] = None


class PatientProfileResponse(PatientProfileBase):
    user_id: str
    model_config = ConfigDict(from_attributes=True)


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str  # "patient" or "doctor"
    created_at: datetime
    patient_profile: Optional[PatientProfileResponse] = None
    model_config = ConfigDict(from_attributes=True)


class PatientListItemResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: datetime
    age: Optional[int] = None
    sex: Optional[str] = None
    allergies: List[str] = Field(default_factory=list)
    conditions: List[str] = Field(default_factory=list)
    prescriptions_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field("patient", pattern="^(patient|doctor)$")
    age: Optional[int] = Field(None, ge=0, le=130)
    sex: Optional[str] = Field(None, max_length=32)
    allergies: List[str] = Field(default_factory=list)
    conditions: List[str] = Field(default_factory=list)
    notes: Optional[str] = None


class LoginResponse(BaseModel):
    message: str
    user: UserResponse
    token: str


# -------------------------------------------------------------
# Medicine Schemas
# -------------------------------------------------------------
class ExtractedMedicineBase(BaseModel):
    original_name: str
    strength: Optional[str] = None
    dosage: Optional[str] = None
    route: Optional[str] = "oral"
    frequency: Optional[str] = None
    frequency_meaning: Optional[str] = None
    duration: Optional[str] = None
    timing_instructions: Optional[str] = None
    food_instructions: Optional[str] = None
    extraction_confidence: float = 0.0
    uncertainty_flags: List[str] = Field(default_factory=list)
    normalized_name: Optional[str] = None
    rxcui: Optional[str] = None
    concept_type: Optional[str] = None
    verification_status: str = "no_verified_match"
    alternatives_json: List[Dict[str, Any]] = Field(default_factory=list)
    reviewer_corrected: bool = False
    reviewer_notes: Optional[str] = None
    bounding_box: Optional[List[float]] = None


class ExtractedMedicineUpdate(BaseModel):
    original_name: Optional[str] = None
    normalized_name: Optional[str] = None
    rxcui: Optional[str] = None
    strength: Optional[str] = None
    dosage: Optional[str] = None
    route: Optional[str] = None
    frequency: Optional[str] = None
    frequency_meaning: Optional[str] = None
    duration: Optional[str] = None
    timing_instructions: Optional[str] = None
    food_instructions: Optional[str] = None
    verification_status: Optional[str] = None
    reviewer_notes: Optional[str] = None
    bounding_box: Optional[List[float]] = None


class ExtractedMedicineResponse(ExtractedMedicineBase):
    id: str
    analysis_id: str
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Evidence Schemas
# -------------------------------------------------------------
class EvidenceBase(BaseModel):
    medicine_name: str
    food_or_substance: str
    evidence_category: str
    source_provider: str
    source_document_title: str
    source_section: Optional[str] = None
    official_source_url: str
    evidence_excerpt: str
    plain_language_summary: str
    retrieval_score: float = 1.0
    retrieval_timestamp: datetime
    retrieval_metadata: Dict[str, Any] = Field(default_factory=dict)


class EvidenceResponse(EvidenceBase):
    id: str
    analysis_id: Optional[str] = "global_catalog"
    medicine_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Review & Audit Schemas
# -------------------------------------------------------------
class ReviewCreate(BaseModel):
    reviewer_name: str = "Dr. Clinician Reviewer"
    reviewer_role: str = "Attending Clinician / Reviewer"
    review_notes: Optional[str] = None
    corrections_made: Dict[str, Any] = Field(default_factory=dict)
    review_duration_seconds: float = 0.0


class ReviewResponse(BaseModel):
    id: str
    analysis_id: str
    reviewer_name: str
    reviewer_role: str
    decision: str
    review_notes: Optional[str] = None
    corrections_made_json: Dict[str, Any] = Field(default_factory=dict)
    review_duration_seconds: float
    decided_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ApprovalRequest(BaseModel):
    reviewer_name: str = "Dr. Clinician Reviewer"
    reviewer_role: str = "Attending Clinician / Reviewer"
    review_notes: Optional[str] = "Prescription verified and approved for patient summary."
    confirmed_no_unresolved_critical_fields: bool = True
    review_duration_seconds: float = 0.0


class RejectRequest(BaseModel):
    reviewer_name: str = "Dr. Clinician Reviewer"
    reviewer_role: str = "Attending Clinician / Reviewer"
    rejection_reason: str = Field(..., min_length=10, description="Detailed reason for clinical rejection (minimum 10 characters)")
    review_duration_seconds: float = 0.0


class AuditEventResponse(BaseModel):
    id: str
    analysis_id: Optional[str] = None
    user_id: Optional[str] = None
    event_type: str
    actor: str
    timestamp: datetime
    details_json: Dict[str, Any] = Field(default_factory=dict)
    model_config = ConfigDict(from_attributes=True)


# -------------------------------------------------------------
# Analysis Schemas
# -------------------------------------------------------------
class AnalysisListItem(BaseModel):
    id: str
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None
    original_filename: str
    created_at: datetime
    stage: str
    status: str
    is_demo: bool
    review_status: str
    medicine_count: int = 0
    total_processing_duration_sec: float = 0.0
    model_config = ConfigDict(from_attributes=True)


class AnalysisResponse(BaseModel):
    id: str
    patient_id: Optional[str] = None
    reviewed_by: Optional[str] = None
    original_filename: str
    stored_filepath: str
    file_checksum: str
    created_at: datetime
    stage: str
    status: str
    error_message: Optional[str] = None
    failed_stage: Optional[str] = None
    is_demo: bool
    demo_scenario_id: Optional[str] = None
    patient_name_detected: Optional[str] = None
    prescriber_name_detected: Optional[str] = None
    prescription_date_detected: Optional[str] = None
    total_processing_duration_sec: float
    image_quality_score: float
    image_quality_feedback: Optional[str] = None
    raw_ocr_baseline: Optional[str] = None
    raw_ai_text: Optional[str] = None
    review_status: str
    rejection_reason: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    medicines: List[ExtractedMedicineResponse] = Field(default_factory=list)
    evidences: List[EvidenceResponse] = Field(default_factory=list)
    reviews: List[ReviewResponse] = Field(default_factory=list)
    audit_events: List[AuditEventResponse] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class AnalysisStatusResponse(BaseModel):
    id: str
    stage: str
    status: str
    error_message: Optional[str] = None
    failed_stage: Optional[str] = None
    review_status: str
    total_processing_duration_sec: float
    stages_completed: List[str]


# -------------------------------------------------------------
# Patient Summary Schema (ONLY FOR APPROVED ANALYSES)
# -------------------------------------------------------------
class PatientScheduleItem(BaseModel):
    medicine_name: str
    strength: str
    dosage: str
    route: str
    timing_schedule: str  # e.g., "Morning & Night", "Once daily at bedtime"
    food_instruction: str  # e.g., "Take after meals"
    caution_notes: Optional[str] = None


class PatientFoodWarningItem(BaseModel):
    medicine_name: str
    food_or_substance: str
    warning_level: str  # AVOID, LIMIT, TIMING, SAFE, UNKNOWN
    advice: str
    source_title: str
    official_source_url: str


class PatientSummaryResponse(BaseModel):
    analysis_id: str
    patient_name: str
    prescriber_name: str
    prescription_date: Optional[str] = None
    approval_date: datetime
    approved_by: str
    reviewer_role: str
    medicines_schedule: List[PatientScheduleItem]
    dietary_warnings: List[PatientFoodWarningItem]
    disclaimer: str = (
        "IMPORTANT NOTICE: This summary is generated from an AI-analyzed prescription and verified by a licensed clinician. "
        "It does not replace professional medical advice, diagnosis, or the original signed prescription. "
        "Always consult your doctor or pharmacist if you experience any unexpected side effects."
    )


# -------------------------------------------------------------
# Dashboard & Metrics Schemas
# -------------------------------------------------------------
class DashboardMetricsResponse(BaseModel):
    total_analyses: int
    pending_doctor_reviews: int
    approved_reports: int
    rejected_reports: int
    failed_analyses: int
    average_processing_time_sec: float
    average_review_time_sec: float
    recent_analyses: List[AnalysisListItem]


# -------------------------------------------------------------
# Dependency Health Schemas
# -------------------------------------------------------------
class SystemHealthResponse(BaseModel):
    status: str
    app_name: str
    version: str
    mode: str


class ServiceHealth(BaseModel):
    status: str  # "healthy", "degraded", "unavailable"
    latency_ms: Optional[float] = None
    details: Optional[str] = None


class DependencyHealthResponse(BaseModel):
    app_version: str
    app_mode: str
    database: ServiceHealth
    gemini_vision: ServiceHealth
    rxnorm_api: ServiceHealth
    dailymed_api: ServiceHealth
    openfda_api: ServiceHealth
    qdrant_vector_store: ServiceHealth
