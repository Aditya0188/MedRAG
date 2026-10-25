import pytest
import os
import io
from unittest.mock import patch, AsyncMock
from app.models.entities import Analysis, ExtractedMedicine, Evidence, ApiCache
from app.services.api_cache import get_cached_api_response, set_cached_api_response
from app.services.rxnorm.rxnorm_client import verify_medicine_terminology, RxNormVerificationResult
from app.services.dailymed.dailymed_client import fetch_dailymed_spl
from app.services.openfda.openfda_client import fetch_openfda_label
from app.services.pipeline_orchestrator import execute_analysis_pipeline, retry_with_backoff


@pytest.mark.asyncio
async def test_retry_with_backoff_success():
    call_count = 0

    async def flaky_fn(arg):
        nonlocal call_count
        call_count += 1
        if call_count < 2:
            raise ConnectionError("Network blip")
        return f"success-{arg}"

    res = await retry_with_backoff(flaky_fn, "test", max_retries=2, initial_delay=0.01)
    assert res == "success-test"
    assert call_count == 2


@pytest.mark.asyncio
async def test_retry_with_backoff_exhaustion():
    async def always_fails():
        raise TimeoutError("Timed out")

    with pytest.raises(TimeoutError):
        await retry_with_backoff(always_fails, max_retries=2, initial_delay=0.01)


def test_api_cache_crud(db_session):
    data = {"generic": "Paracetamol 500 MG", "rxcui": "161"}
    set_cached_api_response("rxnorm", "test_paracetamol|500mg", data, ttl_days=7, db=db_session)

    cached = get_cached_api_response("rxnorm", "test_paracetamol|500mg", db=db_session)
    assert cached is not None
    assert cached["generic"] == "Paracetamol 500 MG"
    assert cached["rxcui"] == "161"

    assert get_cached_api_response("rxnorm", "nonexistent_drug", db=db_session) is None


@pytest.mark.asyncio
async def test_rxnorm_persistent_cache_hit(db_session):
    cached_data = {
        "query_term": "CustomDrug",
        "normalized_name": "CustomDrug Normalized",
        "rxcui": "999999",
        "concept_type": "Clinical Drug",
        "verification_status": "verified_match",
        "candidates": [{"rxcui": "999999", "name": "CustomDrug Normalized", "score": 1.0}],
        "is_regional_brand": False,
        "regional_brand_note": None
    }
    set_cached_api_response("rxnorm", "customdrug|", cached_data, ttl_days=7, db=db_session)

    result = await verify_medicine_terminology("CustomDrug")
    assert result.normalized_name == "CustomDrug Normalized"
    assert result.rxcui == "999999"
    assert result.verification_status == "verified_match"


@pytest.mark.asyncio
async def test_dailymed_persistent_cache_hit(db_session):
    cached_data = {
        "title": "Cached SPL Title",
        "setid": "test-setid-1234",
        "url": "https://dailymed.nlm.nih.gov/test",
        "sections": {"general": "Cached info"}
    }
    set_cached_api_response("dailymed", "cacheddrug", cached_data, ttl_days=7, db=db_session)

    res = await fetch_dailymed_spl("cacheddrug")
    assert res is not None
    assert res.title == "Cached SPL Title"
    assert res.setid == "test-setid-1234"


@pytest.mark.asyncio
async def test_openfda_persistent_cache_hit(db_session):
    cached_data = {
        "brand_name": "CachedBrand",
        "generic_name": "CachedGeneric",
        "spl_id": "spl-999",
        "sections": {"dosage": "Take 1 daily"},
        "source_url": "https://api.fda.gov/test",
        "dosage_forms": ["Tablet"],
        "substance_names": ["CachedSubstance"],
        "boxed_warning": None
    }
    set_cached_api_response("openfda", "cachedfda", cached_data, ttl_days=7, db=db_session)

    res = await fetch_openfda_label("cachedfda")
    assert res is not None
    assert res.brand_name == "CachedBrand"
    assert res.generic_name == "CachedGeneric"


@pytest.mark.asyncio
async def test_concurrent_lookup_failure_isolation(db_session):
    """
    Test that if one medicine lookup fails (e.g. throws an exception),
    the analysis does NOT fail, and the failing drug is marked 'no_verified_match' / 'not_verified'.
    """
    analysis = Analysis(
        original_filename="test_fail_isolation.jpg",
        stored_filepath="./data/samples/prescription_sample_01_clear.jpg",
        file_checksum="test_checksum_fail_isolation",
        stage="uploaded",
        status="pending",
        is_demo=True,
        demo_scenario_id="scenario_1_clear",
        review_status="unreviewed"
    )
    db_session.add(analysis)
    db_session.commit()

    original_verify = verify_medicine_terminology

    async def mock_verify(name, strength=None):
        if "Ibuprofen" in name:
            raise ConnectionError("Simulated network timeout on Ibuprofen")
        return await original_verify(name, strength)

    with patch("app.services.pipeline_orchestrator.verify_medicine_terminology", side_effect=mock_verify):
        completed_analysis = await execute_analysis_pipeline(analysis.id, db_session)

    assert completed_analysis.status == "completed"
    assert completed_analysis.stage == "pending_review"

    meds = db_session.query(ExtractedMedicine).filter(ExtractedMedicine.analysis_id == analysis.id).all()
    assert len(meds) == 2

    # Check that amoxicillin completed verification
    amox = next(m for m in meds if "Amoxicillin" in m.original_name)
    assert amox.verification_status in ("verified_match", "possible_match")

    # Check that ibuprofen was safely isolated and marked not verified
    ibup = next(m for m in meds if "Ibuprofen" in m.original_name)
    assert ibup.verification_status == "no_verified_match"
    assert "not_verified" in ibup.uncertainty_flags


def test_sha256_demo_cache_instant_return(doctor_client, db_session):
    """
    Test that if an uploaded file's SHA-256 matches a completed analysis,
    the endpoint returns the completed result instantly with medicines and evidences.
    """
    file_content = b"Simulated prescription content for sha256 demo cache test. Must exceed 100 bytes of data to pass format validation cleanly."
    from app.services.image_processor import compute_file_checksum
    actual_checksum = compute_file_checksum(file_content)

    # 1. Create a completed analysis in the database with matching checksum
    completed_analysis = Analysis(
        original_filename="sample_rx.jpg",
        stored_filepath="./data/samples/sample_rx.jpg",
        file_checksum=actual_checksum,
        stage="pending_review",
        status="completed",
        review_status="pending_review",
        patient_name_detected="John Doe",
        prescriber_name_detected="Dr. Smith",
        total_processing_duration_sec=1.23
    )
    db_session.add(completed_analysis)
    db_session.commit()

    # Add a medicine with bounding box
    med = ExtractedMedicine(
        analysis_id=completed_analysis.id,
        original_name="Paracetamol 500mg",
        strength="500mg",
        dosage="1 tablet",
        verification_status="verified_match",
        bounding_box=[200.0, 50.0, 280.0, 900.0]
    )
    db_session.add(med)

    # Add an evidence
    ev = Evidence(
        analysis_id=completed_analysis.id,
        medicine_name="Paracetamol",
        food_or_substance="Food",
        evidence_category="timing_instruction",
        source_provider="DailyMed",
        source_document_title="Paracetamol SPL",
        official_source_url="https://dailymed.nlm.nih.gov",
        evidence_excerpt="Can be taken with or without food.",
        plain_language_summary="Safe with food.",
        retrieval_score=0.95
    )
    db_session.add(ev)
    db_session.commit()

    # 2. Post to /analyses with that file
    response = doctor_client.post(
        "/api/v1/analyses",
        files={"file": ("prescription.jpg", io.BytesIO(file_content), "image/jpeg")},
        data={"auto_process": "false"}
    )

    assert response.status_code == 201
    data = response.json()

    # Should be immediately completed from cache
    assert data["status"] == "completed"
    assert data["stage"] == "pending_review"
    assert data["file_checksum"] == actual_checksum
    assert len(data["medicines"]) == 1
    assert data["medicines"][0]["original_name"] == "Paracetamol 500mg"
    assert data["medicines"][0]["bounding_box"] == [200.0, 50.0, 280.0, 900.0]
