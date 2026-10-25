import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.entities import Analysis, ExtractedMedicine, Evidence, AuditEvent
from app.services.image_processor import preprocess_image, run_baseline_ocr
from app.services.vision.gemini_vision import extract_prescription_with_gemini
from app.services.rxnorm.rxnorm_client import verify_medicine_terminology
from app.services.dailymed.dailymed_client import fetch_dailymed_spl
from app.services.openfda.openfda_client import fetch_openfda_label
from app.services.retrieval.qdrant_rag import evidence_store
from app.services.demo_fixtures import DEMO_SCENARIOS

logger = logging.getLogger(__name__)


def utc_now():
    return datetime.now(timezone.utc)


def add_audit_log(
    db: Session,
    analysis_id: Optional[str] = None,
    event_type: str = "",
    actor: str = "system",
    details: dict = None,
    user_id: Optional[str] = None
):
    target_analysis_id = analysis_id if analysis_id else "system_event"
    audit = AuditEvent(
        analysis_id=target_analysis_id,
        user_id=user_id,
        event_type=event_type,
        actor=actor,
        timestamp=utc_now(),
        details_json=details or {}
    )
    db.add(audit)


async def retry_with_backoff(coro_fn, *args, max_retries: int = 2, initial_delay: float = 0.5, backoff_factor: float = 2.0, timeout_sec: float = 10.0, **kwargs):
    """
    Executes an async function with timeout and exponential backoff retries.
    """
    last_err = None
    delay = initial_delay
    for attempt in range(max_retries + 1):
        try:
            return await asyncio.wait_for(coro_fn(*args, **kwargs), timeout=timeout_sec)
        except Exception as e:
            last_err = e
            if attempt < max_retries:
                await asyncio.sleep(delay)
                delay *= backoff_factor
    raise last_err


async def execute_analysis_pipeline(analysis_id: str, db: Session) -> Analysis:
    """
    Executes the multi-stage clinical prescription analysis pipeline:
    1. Prescription uploaded (checked)
    2. Image quality checked
    3. Handwriting analyzed (OCR baseline in parallel with Vision model)
    4. ALL Medicine details extracted with normalized bounding boxes
    5. Drug names verified concurrently (RxNorm ontology, semaphore 5, 10s timeout, retries)
    6. Official drug labels retrieved concurrently (DailyMed & openFDA)
    7. Evidence assembled (Qdrant RAG)
    8. Doctor review required (pending_review)
    """
    start_time = time.time()
    
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise ValueError(f"Analysis with ID {analysis_id} not found.")

    analysis.status = "in_progress"
    db.commit()

    try:
        # -------------------------------------------------------------
        # STAGE 2: Image Quality Checked
        # -------------------------------------------------------------
        analysis.stage = "quality_checked"
        db.commit()
        
        if os.path.exists(analysis.stored_filepath):
            lower_path = analysis.stored_filepath.lower()
            if not lower_path.endswith(".pdf"):
                with open(analysis.stored_filepath, "rb") as f:
                    img_bytes = f.read()
                quality_assessment, _ = preprocess_image(img_bytes, analysis.stored_filepath)
                analysis.image_quality_score = quality_assessment.score
                analysis.image_quality_feedback = quality_assessment.feedback
            else:
                analysis.image_quality_score = 0.90
                analysis.image_quality_feedback = "Digital PDF prescription document loaded."
        else:
            analysis.image_quality_score = 0.85
            analysis.image_quality_feedback = "Standard digital document pre-loaded."
            
        add_audit_log(db, analysis_id, "quality_check_completed", details={"quality_score": analysis.image_quality_score})
        db.commit()

        # -------------------------------------------------------------
        # STAGE 3 & 4: Handwriting Analyzed & Medicine Details Extracted
        # -------------------------------------------------------------
        analysis.stage = "handwriting_analyzed"
        db.commit()

        # Launch Baseline OCR asynchronously so it never blocks Gemini Vision
        baseline_task = asyncio.to_thread(run_baseline_ocr, analysis.stored_filepath)

        extracted_med_items = []
        patient_name = "Patient"
        prescriber_name = "Attending Physician"
        prescription_date = datetime.now().strftime("%Y-%m-%d")

        # Check if running automated test fixture
        if analysis.is_demo and analysis.demo_scenario_id in DEMO_SCENARIOS:
            fixture = DEMO_SCENARIOS[analysis.demo_scenario_id]
            patient_name = fixture["patient_name"]
            prescriber_name = fixture["prescriber_name"]
            prescription_date = fixture["prescription_date"]
            analysis.raw_ai_text = fixture["raw_ai_text"]
            extracted_med_items = fixture["medicines"]
            ocr_res = await baseline_task
            analysis.raw_ocr_baseline = ocr_res if isinstance(ocr_res, str) else "[Tesseract OCR Baseline Unavailable]"
        else:
            # LIVE EXTRACTION: Run Baseline OCR and Gemini Vision concurrently
            api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
            if not api_key:
                raise ValueError(
                    "Gemini API Key is required to analyze your uploaded prescription. "
                    "Please enter your API Key in Settings or the upload panel (get a free key at https://aistudio.google.com/)."
                )

            ocr_res, ai_output = await asyncio.gather(
                baseline_task,
                extract_prescription_with_gemini(analysis.stored_filepath),
                return_exceptions=True
            )

            analysis.raw_ocr_baseline = ocr_res if isinstance(ocr_res, str) else "[Tesseract OCR Baseline Unavailable]"

            if isinstance(ai_output, Exception):
                raise ai_output

            patient_name = ai_output.patient_name or "Patient (Prescription)"
            prescriber_name = ai_output.prescriber_name or "Attending Physician"
            prescription_date = ai_output.prescription_date or datetime.now().strftime("%Y-%m-%d")
            analysis.raw_ai_text = ai_output.raw_text or "Prescription parsed by Gemini Vision AI."

            if not ai_output.medicines:
                raise ValueError("No medications could be detected on the uploaded image. Please ensure the prescription is legible and well-lit.")

            for med in ai_output.medicines:
                # Validate bounding box coordinates if provided: [ymin, xmin, ymax, xmax] 0-1000 scale
                valid_bbox = None
                if getattr(med, "bounding_box", None) and isinstance(med.bounding_box, list) and len(med.bounding_box) == 4:
                    try:
                        valid_bbox = [float(coord) for coord in med.bounding_box]
                    except (ValueError, TypeError):
                        valid_bbox = None

                extracted_med_items.append({
                    "original_name": med.original_name,
                    "normalized_name": med.possible_generic_name,
                    "strength": med.strength,
                    "dosage": med.dosage,
                    "route": med.route or "oral",
                    "frequency": med.frequency_as_written,
                    "frequency_meaning": med.frequency_meaning,
                    "duration": med.duration_as_written,
                    "timing_instructions": med.timing_as_written,
                    "food_instructions": med.food_instructions_as_written,
                    "extraction_confidence": med.confidence,
                    "verification_status": "no_verified_match",
                    "uncertainty_flags": med.uncertainty_flags,
                    "alternatives_json": [],
                    "reviewer_corrected": False,
                    "bounding_box": valid_bbox
                })

        analysis.patient_name_detected = patient_name
        analysis.prescriber_name_detected = prescriber_name
        analysis.prescription_date_detected = prescription_date

        analysis.stage = "extraction_complete"
        # Delete previous medicines on retry to prevent duplicates
        db.query(ExtractedMedicine).filter(ExtractedMedicine.analysis_id == analysis_id).delete()
        
        medicine_records = []
        for item in extracted_med_items:
            med_obj = ExtractedMedicine(
                analysis_id=analysis_id,
                original_name=item["original_name"],
                strength=item.get("strength"),
                dosage=item.get("dosage"),
                route=item.get("route", "oral"),
                frequency=item.get("frequency"),
                frequency_meaning=item.get("frequency_meaning"),
                duration=item.get("duration"),
                timing_instructions=item.get("timing_instructions"),
                food_instructions=item.get("food_instructions"),
                extraction_confidence=item.get("extraction_confidence", 0.85),
                verification_status=item.get("verification_status", "no_verified_match"),
                uncertainty_flags=item.get("uncertainty_flags", []),
                alternatives_json=item.get("alternatives_json", []),
                normalized_name=item.get("normalized_name"),
                rxcui=item.get("rxcui"),
                concept_type=item.get("concept_type"),
                bounding_box=item.get("bounding_box")
            )
            db.add(med_obj)
            medicine_records.append(med_obj)

        db.commit()
        add_audit_log(db, analysis_id, "extraction_completed", details={"medicine_count": len(medicine_records)})

        # -------------------------------------------------------------
        # STAGE 5: Drug Names Verified (RxNorm Ontological Grounding)
        # Concurrent execution with Semaphore(5), 10s timeouts, 2 retries
        # -------------------------------------------------------------
        analysis.stage = "verification_complete"
        db.commit()

        sem = asyncio.Semaphore(5)

        async def _verify_single_med(med_rec: ExtractedMedicine):
            async with sem:
                try:
                    verif_res = await retry_with_backoff(
                        verify_medicine_terminology,
                        med_rec.original_name,
                        med_rec.strength,
                        max_retries=2,
                        timeout_sec=10.0
                    )
                    if verif_res.normalized_name:
                        med_rec.normalized_name = verif_res.normalized_name
                        med_rec.rxcui = verif_res.rxcui
                        med_rec.concept_type = verif_res.concept_type
                        med_rec.verification_status = verif_res.verification_status
                        med_rec.alternatives_json = [c.model_dump() for c in verif_res.candidates]
                        if verif_res.is_regional_brand and verif_res.regional_brand_note:
                            med_rec.uncertainty_flags = list(set(med_rec.uncertainty_flags + ["regional_brand_mapping"]))
                    else:
                        med_rec.verification_status = "no_verified_match"
                except Exception as rx_err:
                    logger.warning(f"RxNorm grounding error for {med_rec.original_name} after retries: {rx_err}")
                    # Drug verification failure must never fail the entire analysis pipeline
                    med_rec.verification_status = "no_verified_match"
                    med_rec.uncertainty_flags = list(set(med_rec.uncertainty_flags + ["not_verified"]))

        await asyncio.gather(*[_verify_single_med(m) for m in medicine_records])
        db.commit()
        add_audit_log(db, analysis_id, "verification_completed")

        # -------------------------------------------------------------
        # STAGE 6 & 7: Official Drug Labels Retrieved & Evidence Assembled
        # Concurrent execution with Semaphore(5), 10s timeouts, 2 retries
        # -------------------------------------------------------------
        analysis.stage = "evidence_complete"
        db.query(Evidence).filter(Evidence.analysis_id == analysis_id).delete()
        db.commit()

        if analysis.is_demo and analysis.demo_scenario_id in DEMO_SCENARIOS:
            for ev in DEMO_SCENARIOS[analysis.demo_scenario_id]["evidences"]:
                matched_med = next((m for m in medicine_records if ev["medicine_name"].lower() in m.original_name.lower()), None)
                ev_obj = Evidence(
                    analysis_id=analysis_id,
                    medicine_id=matched_med.id if matched_med else None,
                    medicine_name=ev["medicine_name"],
                    food_or_substance=ev["food_or_substance"],
                    evidence_category=ev["evidence_category"],
                    source_provider=ev["source_provider"],
                    source_document_title=ev["source_document_title"],
                    source_section=ev.get("source_section"),
                    official_source_url=ev["official_source_url"],
                    evidence_excerpt=ev["evidence_excerpt"],
                    plain_language_summary=ev["plain_language_summary"],
                    retrieval_score=ev.get("retrieval_score", 0.95),
                    retrieval_timestamp=utc_now()
                )
                db.add(ev_obj)
            db.commit()
        else:
            # LIVE FDA DailyMed & openFDA RETRIEVAL FOR ALL EXTRACTED MEDICINES CONCURRENTLY
            async def _retrieve_evidence_for_med(med_rec: ExtractedMedicine) -> List[Evidence]:
                async with sem:
                    ev_records = []
                    med_name = med_rec.normalized_name or med_rec.original_name
                    clean_lookup_name = med_name.replace("Tab.", "").replace("Cap.", "").replace("Syp.", "").strip()
                    clean_orig = med_rec.original_name.replace("Tab.", "").replace("Cap.", "").replace("Syp.", "").replace("Inj.", "").strip()

                    # 1. Search Qdrant vector index
                    qdrant_hits = evidence_store.search_evidence(clean_lookup_name)
                    if not qdrant_hits and clean_orig.lower() != clean_lookup_name.lower():
                        qdrant_hits = evidence_store.search_evidence(clean_orig)

                    if qdrant_hits:
                        for hit in qdrant_hits[:2]:
                            ev_records.append(Evidence(
                                analysis_id=analysis_id,
                                medicine_id=med_rec.id,
                                medicine_name=hit.get("medicine_name", clean_lookup_name),
                                food_or_substance=hit.get("food_or_substance", "Food / Beverage Interaction"),
                                evidence_category=hit.get("evidence_category", "timing_instruction"),
                                source_provider=hit.get("source_provider", "DailyMed"),
                                source_document_title=hit.get("source_document_title", "FDA Drug Labeling"),
                                source_section=hit.get("source_section"),
                                official_source_url=hit.get("official_source_url", "https://dailymed.nlm.nih.gov"),
                                evidence_excerpt=hit.get("evidence_excerpt", ""),
                                plain_language_summary=hit.get("plain_language_summary", ""),
                                retrieval_score=0.92,
                                retrieval_timestamp=utc_now()
                            ))
                        return ev_records

                    # 2. Live fetch from DailyMed and openFDA concurrently with retry and timeout
                    dailymed_label = None
                    try:
                        dailymed_label = await retry_with_backoff(
                            fetch_dailymed_spl,
                            clean_lookup_name,
                            max_retries=2,
                            timeout_sec=10.0
                        )
                    except Exception as dm_err:
                        logger.warning(f"DailyMed fetch failed for {clean_lookup_name}: {dm_err}")

                    openfda_label = None
                    try:
                        openfda_label = await retry_with_backoff(
                            fetch_openfda_label,
                            clean_lookup_name,
                            max_retries=2,
                            timeout_sec=10.0
                        )
                    except Exception as fda_err:
                        logger.warning(f"openFDA fetch failed for {clean_lookup_name}: {fda_err}")

                    if dailymed_label:
                        ev_records.append(Evidence(
                            analysis_id=analysis_id,
                            medicine_id=med_rec.id,
                            medicine_name=clean_lookup_name,
                            food_or_substance="Dietary Administration",
                            evidence_category="timing_instruction",
                            source_provider="DailyMed",
                            source_document_title=dailymed_label.title,
                            source_section="DOSAGE AND ADMINISTRATION",
                            official_source_url=dailymed_label.url,
                            evidence_excerpt=dailymed_label.sections.get("general_information", "Refer to full official DailyMed SPL."),
                            plain_language_summary=f"Consult official FDA product labeling for administration and food instructions regarding {clean_lookup_name}.",
                            retrieval_score=0.90,
                            retrieval_timestamp=utc_now()
                        ))
                    elif openfda_label:
                        food_sec = openfda_label.sections.get("food_safety_warning") or openfda_label.sections.get("dosage_and_administration", "See official openFDA label.")
                        ev_records.append(Evidence(
                            analysis_id=analysis_id,
                            medicine_id=med_rec.id,
                            medicine_name=clean_lookup_name,
                            food_or_substance="Dietary Administration",
                            evidence_category="timing_instruction",
                            source_provider="openFDA",
                            source_document_title=f"{openfda_label.generic_name} FDA Label",
                            source_section="PATIENT INFORMATION",
                            official_source_url=openfda_label.source_url,
                            evidence_excerpt=food_sec,
                            plain_language_summary=f"Administer {openfda_label.generic_name} according to official FDA instructions.",
                            retrieval_score=0.88,
                            retrieval_timestamp=utc_now()
                        ))
                    else:
                        # Explicit insufficient evidence category - never invent warnings!
                        ev_records.append(Evidence(
                            analysis_id=analysis_id,
                            medicine_id=med_rec.id,
                            medicine_name=clean_lookup_name,
                            food_or_substance="General Diet",
                            evidence_category="unavailable_insufficient",
                            source_provider="DailyMed / openFDA",
                            source_document_title=f"{clean_lookup_name} Label Search",
                            source_section="N/A",
                            official_source_url="https://dailymed.nlm.nih.gov",
                            evidence_excerpt="No verified product label passage found matching query terms in official NLM DailyMed or openFDA index.",
                            plain_language_summary="No verified drug label evidence available for this specific query term. Consult attending clinician or pharmacist.",
                            retrieval_score=0.0,
                            retrieval_timestamp=utc_now()
                        ))
                    return ev_records

            all_ev_lists = await asyncio.gather(*[_retrieve_evidence_for_med(m) for m in medicine_records])
            for ev_list in all_ev_lists:
                for ev in ev_list:
                    db.add(ev)
            db.commit()

        # -------------------------------------------------------------
        # STAGE 8: Doctor Review Required
        # -------------------------------------------------------------
        analysis.stage = "pending_review"
        analysis.status = "completed"
        analysis.review_status = "pending_review"
        analysis.total_processing_duration_sec = round(time.time() - start_time, 2)
        analysis.error_message = None
        analysis.failed_stage = None
        db.commit()

        add_audit_log(db, analysis_id, "pipeline_completed_pending_review", details={"duration_sec": analysis.total_processing_duration_sec})
        logger.info(f"Analysis {analysis_id} processing pipeline successfully completed for {len(medicine_records)} medicines in {analysis.total_processing_duration_sec}s")
        return analysis

    except Exception as e:
        logger.error(f"Pipeline error on analysis {analysis_id} at stage {analysis.stage}: {str(e)}")
        analysis.status = "failed"
        analysis.failed_stage = analysis.stage
        analysis.stage = "failed"
        analysis.error_message = f"Processing error at stage '{analysis.failed_stage}': {str(e)}"
        analysis.total_processing_duration_sec = round(time.time() - start_time, 2)
        db.commit()
        add_audit_log(db, analysis_id, "pipeline_failed", details={"stage": analysis.failed_stage, "error": str(e)})
        raise e
