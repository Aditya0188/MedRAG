import asyncio
import os
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from app.core.config import settings
from app.db.session import get_db
from app.models.entities import Analysis, ExtractedMedicine, AuditEvent
from app.schemas.schemas import (
    AnalysisResponse, AnalysisListItem, AnalysisStatusResponse
)
from app.services.image_processor import compute_file_checksum
from app.services.pipeline_orchestrator import execute_analysis_pipeline, add_audit_log
from app.services.demo_fixtures import DEMO_SCENARIOS, seed_sample_prescriptions

router = APIRouter()

ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"]
ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"]


@router.post("/analyses", response_model=AnalysisResponse, status_code=201, tags=["Analyses"])
async def create_analysis(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    demo_scenario_id: Optional[str] = Form(None),
    auto_process: bool = Form(True),
    db: Session = Depends(get_db)
):
    """
    Creates a new prescription analysis.
    Accepts either an uploaded file (JPEG/PNG/PDF) or a sample demo scenario ID.
    """
    seed_sample_prescriptions()
    is_demo = False
    original_filename = ""
    stored_path = ""
    checksum = ""

    if demo_scenario_id:
        if demo_scenario_id not in DEMO_SCENARIOS:
            raise HTTPException(status_code=400, detail=f"Invalid demo scenario ID: {demo_scenario_id}")
        scenario = DEMO_SCENARIOS[demo_scenario_id]
        original_filename = scenario["filename"]
        source_path = os.path.join(settings.SAMPLES_DIR, original_filename)
        
        # Copy sample image to uploads directory
        stored_path = os.path.join(settings.UPLOAD_DIR, f"demo_{demo_scenario_id}_{original_filename}")
        if os.path.exists(source_path):
            shutil.copyfile(source_path, stored_path)
            with open(stored_path, "rb") as f:
                checksum = compute_file_checksum(f.read())
        else:
            checksum = f"demo_checksum_{demo_scenario_id}"
            
        is_demo = True

    elif file:
        # Validate File
        filename = file.filename or "prescription.jpg"
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format '{ext}'. Supported formats: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        contents = await file.read()
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if len(contents) > max_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds maximum allowed limit of {settings.MAX_UPLOAD_SIZE_MB} MB."
            )
        if len(contents) < 100:
            raise HTTPException(status_code=400, detail="Uploaded file is empty or corrupted.")

        checksum = compute_file_checksum(contents)
        original_filename = filename
        
        # Generate safe unique filepath
        import uuid
        safe_filename = f"{uuid.uuid4()}{ext}"
        stored_path = os.path.join(settings.UPLOAD_DIR, safe_filename)
        
        with open(stored_path, "wb") as f:
            f.write(contents)
    else:
        raise HTTPException(status_code=400, detail="Must provide either an uploaded file or demo_scenario_id.")

    # Create Analysis record
    analysis = Analysis(
        original_filename=original_filename,
        stored_filepath=stored_path,
        file_checksum=checksum,
        stage="uploaded",
        status="pending",
        is_demo=is_demo,
        demo_scenario_id=demo_scenario_id,
        review_status="unreviewed"
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    add_audit_log(db, analysis.id, "analysis_created", actor="user", details={"filename": original_filename, "is_demo": is_demo})
    db.commit()

    # Automatically trigger processing pipeline in background if requested
    if auto_process:
        # We can run inline or via background task
        # To make demo responsive and reliable, we run pipeline
        background_tasks.add_task(run_pipeline_task, analysis.id)

    return analysis


def run_pipeline_task(analysis_id: str):
    """Background task worker wrapper with isolated DB session."""
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        asyncio.run(execute_analysis_pipeline(analysis_id, db))
    except Exception as e:
        print(f"Background pipeline failed for {analysis_id}: {str(e)}")
    finally:
        db.close()


@router.get("/analyses", response_model=List[AnalysisListItem], tags=["Analyses"])
def list_analyses(
    status: Optional[str] = None,
    review_status: Optional[str] = None,
    is_demo: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """List and filter saved analyses."""
    query = db.query(Analysis)

    if status:
        query = query.filter(Analysis.status == status)
    if review_status:
        query = query.filter(Analysis.review_status == review_status)
    if is_demo is not None:
        query = query.filter(Analysis.is_demo == is_demo)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Analysis.original_filename.ilike(search_filter),
                Analysis.patient_name_detected.ilike(search_filter),
                Analysis.prescriber_name_detected.ilike(search_filter)
            )
        )

    items = query.order_by(desc(Analysis.created_at)).offset(skip).limit(limit).all()
    
    # Map medicine count
    result = []
    for item in items:
        med_count = db.query(ExtractedMedicine).filter(ExtractedMedicine.analysis_id == item.id).count()
        result.append(
            AnalysisListItem(
                id=item.id,
                original_filename=item.original_filename,
                created_at=item.created_at,
                stage=item.stage,
                status=item.status,
                is_demo=item.is_demo,
                review_status=item.review_status,
                medicine_count=med_count,
                total_processing_duration_sec=item.total_processing_duration_sec
            )
        )
    return result


@router.get("/analyses/{analysis_id}", response_model=AnalysisResponse, tags=["Analyses"])
def get_analysis(analysis_id: str, db: Session = Depends(get_db)):
    """Retrieve full analysis entity including medicines, evidence, review, and audit trail."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis record not found.")
    return analysis


@router.post("/analyses/{analysis_id}/process", response_model=AnalysisResponse, tags=["Analyses"])
async def trigger_processing(analysis_id: str, db: Session = Depends(get_db)):
    """Trigger or re-run the full multi-stage processing pipeline."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis record not found.")

    if analysis.status == "in_progress":
        raise HTTPException(status_code=409, detail="Analysis processing is already in progress.")

    updated_analysis = await execute_analysis_pipeline(analysis_id, db)
    return updated_analysis


@router.get("/analyses/{analysis_id}/status", response_model=AnalysisStatusResponse, tags=["Analyses"])
def get_analysis_status(analysis_id: str, db: Session = Depends(get_db)):
    """Check current processing stage, status, and duration."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis record not found.")

    all_stages = [
        "uploaded",
        "quality_checked",
        "handwriting_analyzed",
        "extraction_complete",
        "verification_complete",
        "evidence_complete",
        "pending_review",
        "approved"
    ]
    
    stages_completed = []
    if analysis.stage in all_stages:
        current_idx = all_stages.index(analysis.stage)
        stages_completed = all_stages[:current_idx + 1]

    return AnalysisStatusResponse(
        id=analysis.id,
        stage=analysis.stage,
        status=analysis.status,
        error_message=analysis.error_message,
        failed_stage=analysis.failed_stage,
        review_status=analysis.review_status,
        total_processing_duration_sec=analysis.total_processing_duration_sec,
        stages_completed=stages_completed
    )


@router.post("/analyses/{analysis_id}/retry", response_model=AnalysisResponse, tags=["Analyses"])
async def retry_failed_analysis(analysis_id: str, db: Session = Depends(get_db)):
    """Retry recoverable pipeline processing after a failure."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis record not found.")

    add_audit_log(db, analysis_id, "pipeline_retry_requested", actor="user")
    updated = await execute_analysis_pipeline(analysis_id, db)
    return updated


@router.get("/analyses/{analysis_id}/image", tags=["Analyses"])
def get_prescription_image(analysis_id: str, db: Session = Depends(get_db)):
    """Serves the original prescription image for side-by-side clinician comparison."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis record not found.")

    if not os.path.exists(analysis.stored_filepath):
        raise HTTPException(status_code=404, detail="Prescription image file not found on disk.")

    media_type = "image/jpeg"
    if analysis.stored_filepath.lower().endswith(".png"):
        media_type = "image/png"
    elif analysis.stored_filepath.lower().endswith(".pdf"):
        media_type = "application/pdf"

    return FileResponse(analysis.stored_filepath, media_type=media_type)
