from datetime import datetime, timezone
import uuid
from sqlalchemy import (
    Column, String, Boolean, Float, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from app.db.session import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    original_filename = Column(String(255), nullable=False)
    stored_filepath = Column(String(512), nullable=False)
    file_checksum = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    
    # State Machine
    stage = Column(String(64), default="uploaded", nullable=False)
    status = Column(String(32), default="pending", nullable=False)
    error_message = Column(Text, nullable=True)
    failed_stage = Column(String(64), nullable=True)
    
    # Mode
    is_demo = Column(Boolean, default=False, nullable=False)
    demo_scenario_id = Column(String(64), nullable=True)
    
    # Extracted Header Info
    patient_name_detected = Column(String(255), nullable=True)
    prescriber_name_detected = Column(String(255), nullable=True)
    prescription_date_detected = Column(String(64), nullable=True)
    
    # Processing Metrics
    total_processing_duration_sec = Column(Float, default=0.0)
    image_quality_score = Column(Float, default=0.0)
    image_quality_feedback = Column(Text, nullable=True)
    raw_ocr_baseline = Column(Text, nullable=True)  # Tesseract Control Baseline
    raw_ai_text = Column(Text, nullable=True)
    
    # Doctor Review Status
    review_status = Column(String(32), default="unreviewed", nullable=False)  # unreviewed, pending_review, approved, rejected, correction_requested
    
    # Relationships
    medicines = relationship("ExtractedMedicine", back_populates="analysis", cascade="all, delete-orphan", order_by="ExtractedMedicine.id")
    evidences = relationship("Evidence", back_populates="analysis", cascade="all, delete-orphan", order_by="Evidence.retrieval_timestamp")
    reviews = relationship("Review", back_populates="analysis", cascade="all, delete-orphan", order_by="Review.decided_at.desc()")
    audit_events = relationship("AuditEvent", back_populates="analysis", cascade="all, delete-orphan", order_by="AuditEvent.timestamp.desc()")


class ExtractedMedicine(Base):
    __tablename__ = "extracted_medicines"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    analysis_id = Column(String(36), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Transcription as written
    original_name = Column(String(255), nullable=False)
    strength = Column(String(100), nullable=True)
    dosage = Column(String(100), nullable=True)
    route = Column(String(50), nullable=True)
    frequency = Column(String(100), nullable=True)
    frequency_meaning = Column(String(150), nullable=True)
    duration = Column(String(100), nullable=True)
    timing_instructions = Column(String(255), nullable=True)
    food_instructions = Column(String(255), nullable=True)
    
    # Model confidence & uncertainties
    extraction_confidence = Column(Float, default=0.0)
    uncertainty_flags = Column(JSON, default=list)  # list of strings e.g. ["unclear_handwriting", "unclear_strength"]
    
    # RxNorm Verification
    normalized_name = Column(String(255), nullable=True)
    rxcui = Column(String(50), nullable=True, index=True)
    concept_type = Column(String(100), nullable=True)
    verification_status = Column(String(50), default="no_verified_match", nullable=False)
    # verified_match, possible_match, no_verified_match, unclear_handwriting, unsupported_regional_brand
    alternatives_json = Column(JSON, default=list)  # list of alternate candidate objects
    
    # Clinician Review
    reviewer_corrected = Column(Boolean, default=False)
    reviewer_notes = Column(Text, nullable=True)

    # Relationships
    analysis = relationship("Analysis", back_populates="medicines")
    evidences = relationship("Evidence", back_populates="medicine", cascade="all, delete-orphan")


class Evidence(Base):
    __tablename__ = "evidences"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    analysis_id = Column(String(36), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    medicine_id = Column(String(36), ForeignKey("extracted_medicines.id", ondelete="SET NULL"), nullable=True, index=True)
    
    medicine_name = Column(String(255), nullable=False)
    food_or_substance = Column(String(255), nullable=False)
    
    # Categorization strictly supported by source
    evidence_category = Column(String(64), nullable=False)
    # avoid_contraindicated, limit_caution, timing_instruction, no_relevant_warning, unavailable_insufficient
    
    # Official Source Metadata
    source_provider = Column(String(64), nullable=False)  # DailyMed or openFDA
    source_document_title = Column(String(512), nullable=False)
    source_section = Column(String(255), nullable=True)
    official_source_url = Column(String(1024), nullable=False)
    
    # Text passages
    evidence_excerpt = Column(Text, nullable=False)
    plain_language_summary = Column(Text, nullable=False)
    
    retrieval_score = Column(Float, default=1.0)
    retrieval_timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    retrieval_metadata = Column(JSON, default=dict)

    # Relationships
    analysis = relationship("Analysis", back_populates="evidences")
    medicine = relationship("ExtractedMedicine", back_populates="evidences")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    analysis_id = Column(String(36), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    
    reviewer_name = Column(String(255), nullable=False)
    reviewer_role = Column(String(100), default="Attending Clinician / Reviewer", nullable=False)
    decision = Column(String(32), nullable=False)  # approved, rejected, correction_requested
    review_notes = Column(Text, nullable=True)
    corrections_made_json = Column(JSON, default=dict)
    review_duration_seconds = Column(Float, default=0.0)
    decided_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    analysis = relationship("Analysis", back_populates="reviews")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    analysis_id = Column(String(36), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(64), nullable=False)
    actor = Column(String(100), default="system", nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    details_json = Column(JSON, default=dict)

    # Relationships
    analysis = relationship("Analysis", back_populates="audit_events")
