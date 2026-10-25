import pytest
from app.models.entities import Analysis, ExtractedMedicine, Review, AuditEvent


def test_login_success(unauthenticated_client):
    resp = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"email": "dr.chen@meddrag.hospital", "password": "DemoPassword123!"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["email"] == "dr.chen@meddrag.hospital"
    assert data["user"]["role"] == "doctor"
    assert "token" in data
    assert "meddrag_token" in resp.cookies


def test_login_invalid_password(unauthenticated_client):
    resp = unauthenticated_client.post(
        "/api/v1/auth/login",
        json={"email": "dr.chen@meddrag.hospital", "password": "WrongPassword!"}
    )
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.json()["detail"]


def test_auth_me(patient_client):
    resp = patient_client.get("/api/v1/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "john.miller@example.com"
    assert data["role"] == "patient"


def test_logout(patient_client):
    resp = patient_client.post("/api/v1/auth/logout")
    assert resp.status_code == 200


def test_patient_upload_enforces_own_patient_id(patient_client):
    # Patient uploads a prescription
    resp = patient_client.post(
        "/api/v1/analyses",
        data={"demo_scenario_id": "scenario_1_clear", "auto_process": True}
    )
    assert resp.status_code == 201
    analysis = resp.json()
    # Backend must assign current patient id
    assert analysis["patient_id"] == "test-pat-001"


def test_patient_cannot_read_another_patients_analysis(patient_client, other_patient_client, db_session):
    # Create analysis owned by Patient 2 (Priya Patel, test-pat-002)
    resp = other_patient_client.post(
        "/api/v1/analyses",
        data={"demo_scenario_id": "scenario_1_clear", "auto_process": True}
    )
    assert resp.status_code == 201
    analysis_id = resp.json()["id"]

    # Patient 1 (John Miller, test-pat-001) attempts to read Patient 2's analysis
    unauthorized_resp = patient_client.get(f"/api/v1/analyses/{analysis_id}")
    assert unauthorized_resp.status_code == 403
    assert "Access denied" in unauthorized_resp.json()["detail"]


def test_patient_cannot_approve_analysis(patient_client, doctor_client):
    # Patient uploads an analysis
    resp = patient_client.post(
        "/api/v1/analyses",
        data={"demo_scenario_id": "scenario_1_clear", "auto_process": True}
    )
    analysis_id = resp.json()["id"]

    # Patient tries to call approve -> MUST BE 403 FORBIDDEN
    approve_resp = patient_client.post(
        f"/api/v1/analyses/{analysis_id}/approve",
        json={
            "reviewer_name": "Unauthorized Patient",
            "reviewer_role": "Patient",
            "review_notes": "Self approval attempt"
        }
    )
    assert approve_resp.status_code == 403
    assert "Clinician (Doctor) account required" in approve_resp.json()["detail"]


def test_patient_cannot_see_unapproved_summary(patient_client, db_session):
    # Create an unapproved analysis for Patient 1
    analysis = Analysis(
        patient_id="test-pat-001",
        original_filename="test_unapproved.jpg",
        stored_filepath="./data/samples/sample_rx_01_ambiguity.jpg",
        file_checksum="unapproved_checksum",
        stage="pending_review",
        status="completed",
        review_status="pending_review"
    )
    db_session.add(analysis)
    db_session.commit()
    db_session.refresh(analysis)

    # Patient attempts to access patient summary prior to approval -> MUST BE 403
    resp = patient_client.get(f"/api/v1/analyses/{analysis.id}/patient-summary")
    assert resp.status_code == 403
    assert "strictly unavailable until verified and approved" in resp.json()["detail"]


def test_patient_cannot_see_rejected_summary(patient_client, db_session):
    # Create a rejected analysis for Patient 1
    analysis = Analysis(
        patient_id="test-pat-001",
        original_filename="test_rejected.jpg",
        stored_filepath="./data/samples/sample_rx_01_ambiguity.jpg",
        file_checksum="rejected_checksum",
        stage="rejected",
        status="completed",
        review_status="rejected",
        rejection_reason="Unreadable prescription handwriting."
    )
    db_session.add(analysis)
    db_session.commit()
    db_session.refresh(analysis)

    # Accessing summary of rejected report MUST RETURN 403
    resp = patient_client.get(f"/api/v1/analyses/{analysis.id}/patient-summary")
    assert resp.status_code == 403


def test_patient_can_see_own_approved_summary(patient_client, doctor_client, db_session):
    # Patient uploads
    resp = patient_client.post(
        "/api/v1/analyses",
        data={"demo_scenario_id": "scenario_1_clear", "auto_process": True}
    )
    analysis_id = resp.json()["id"]

    # Doctor approves
    doctor_client.post(
        f"/api/v1/analyses/{analysis_id}/approve",
        json={
            "reviewer_name": "Dr. Sarah Chen, MD",
            "reviewer_role": "Attending Clinician / Reviewer",
            "review_notes": "Prescription verified and approved."
        }
    )

    # Patient can now successfully view their own approved summary
    summary_resp = patient_client.get(f"/api/v1/analyses/{analysis_id}/patient-summary")
    assert summary_resp.status_code == 200
    data = summary_resp.json()
    assert data["analysis_id"] == analysis_id
    assert len(data["medicines_schedule"]) >= 1


def test_doctor_can_view_all_and_manage_settings(doctor_client, patient_client):
    # Doctor views patient list
    patients_resp = doctor_client.get("/api/v1/patients")
    assert patients_resp.status_code == 200
    assert len(patients_resp.json()) >= 2

    # Patient tries to view patients list -> 403
    unauth_resp = patient_client.get("/api/v1/patients")
    assert unauth_resp.status_code == 403

    # Patient tries to update settings key -> 403
    key_resp = patient_client.post("/api/v1/settings/key", json={"api_key": "fake_key"})
    assert key_resp.status_code == 403

    # Doctor can update settings key
    doc_key_resp = doctor_client.post("/api/v1/settings/key", json={"api_key": "test_active_key"})
    assert doc_key_resp.status_code == 200


def test_patient_profile_update(patient_client):
    # Patient updates their allergies and conditions
    resp = patient_client.put(
        "/api/v1/patients/me",
        json={
            "age": 53,
            "allergies": ["Penicillin", "Sulfa drugs", "Aspirin"],
            "conditions": ["Hypertension", "Type 2 Diabetes"],
            "notes": "Updated patient notes."
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["age"] == 53
    assert "Aspirin" in data["allergies"]
    assert data["notes"] == "Updated patient notes."


def test_doctor_rejection_flow(patient_client, doctor_client, db_session):
    # Patient uploads an analysis
    resp = patient_client.post(
        "/api/v1/analyses",
        data={"demo_scenario_id": "scenario_1_clear", "auto_process": True}
    )
    assert resp.status_code == 201
    analysis_id = resp.json()["id"]

    # Short rejection reason (<10 chars) must be rejected by Pydantic validation (422)
    short_resp = doctor_client.post(
        f"/api/v1/analyses/{analysis_id}/reject",
        json={
            "reviewer_name": "Dr. Sarah Chen, MD",
            "reviewer_role": "Attending Clinician / Reviewer",
            "rejection_reason": "bad"
        }
    )
    assert short_resp.status_code == 422

    # Valid rejection with >=10 chars
    reason = "Prescription image is too blurry to verify dosage safely."
    reject_resp = doctor_client.post(
        f"/api/v1/analyses/{analysis_id}/reject",
        json={
            "reviewer_name": "Dr. Sarah Chen, MD",
            "reviewer_role": "Attending Clinician / Reviewer",
            "rejection_reason": reason,
            "review_duration_seconds": 18.5
        }
    )
    assert reject_resp.status_code == 200
    assert reject_resp.json()["decision"] == "rejected"

    # Verify Analysis row updated
    analysis = db_session.query(Analysis).filter(Analysis.id == analysis_id).first()
    assert analysis.review_status == "rejected"
    assert analysis.stage == "rejected"
    assert analysis.rejection_reason == reason
    assert analysis.reviewed_by == "test-doc-001"
    assert analysis.reviewed_at is not None

    # Verify audit event logged
    audit = db_session.query(AuditEvent).filter(
        AuditEvent.analysis_id == analysis_id,
        AuditEvent.event_type == "reject"
    ).first()
    assert audit is not None
    assert audit.actor == "Dr. Sarah Chen, MD"


def test_patient_cannot_reject_analysis(patient_client):
    # Patient uploads
    resp = patient_client.post(
        "/api/v1/analyses",
        data={"demo_scenario_id": "scenario_1_clear", "auto_process": True}
    )
    analysis_id = resp.json()["id"]

    # Patient tries to reject -> 403 Forbidden
    reject_resp = patient_client.post(
        f"/api/v1/analyses/{analysis_id}/reject",
        json={
            "reviewer_name": "Unauthorized Patient",
            "rejection_reason": "Attempting patient rejection"
        }
    )
    assert reject_resp.status_code == 403
    assert "Clinician (Doctor) account required" in reject_resp.json()["detail"]


def test_sse_events_authorization(unauthenticated_client, patient_client, other_patient_client, doctor_client):
    # Patient 1 creates an analysis
    resp = patient_client.post(
        "/api/v1/analyses",
        data={"demo_scenario_id": "scenario_1_clear", "auto_process": True}
    )
    analysis_id = resp.json()["id"]

    # Unauthenticated request -> 401
    unauth_resp = unauthenticated_client.get(f"/api/v1/analyses/{analysis_id}/events")
    assert unauth_resp.status_code == 401

    # Patient 2 (different patient) tries to stream Patient 1's events -> 403
    p2_resp = other_patient_client.get(f"/api/v1/analyses/{analysis_id}/events")
    assert p2_resp.status_code == 403
    assert "Access denied" in p2_resp.json()["detail"]

    # Patient 1 streams their own events -> 200, Content-Type: text/event-stream
    with patient_client.stream("GET", f"/api/v1/analyses/{analysis_id}/events") as sse_stream:
        assert sse_stream.status_code == 200
        assert "text/event-stream" in sse_stream.headers.get("content-type", "")
        # Read the first event chunk to confirm streaming
        for chunk in sse_stream.iter_text():
            if "data:" in chunk:
                break

    # Doctor can stream any patient's events -> 200
    with doctor_client.stream("GET", f"/api/v1/analyses/{analysis_id}/events") as doc_stream:
        assert doc_stream.status_code == 200
        assert "text/event-stream" in doc_stream.headers.get("content-type", "")
        for chunk in doc_stream.iter_text():
            if "data:" in chunk:
                break


def test_patient_summary_translation_and_caching(patient_client, other_patient_client, doctor_client):
    # Patient uploads and doctor approves
    resp = patient_client.post(
        "/api/v1/analyses",
        data={"demo_scenario_id": "scenario_1_clear", "auto_process": True}
    )
    analysis_id = resp.json()["id"]

    # Unapproved translation attempt -> 403
    unapproved_trans = patient_client.get(f"/api/v1/analyses/{analysis_id}/patient-summary/translate?lang=hi")
    assert unapproved_trans.status_code == 403

    # Doctor approves
    doctor_client.post(
        f"/api/v1/analyses/{analysis_id}/approve",
        json={
            "reviewer_name": "Dr. Sarah Chen, MD",
            "reviewer_role": "Attending Clinician / Reviewer",
            "review_notes": "Prescription verified for Hindi translation."
        }
    )

    # Other patient cannot view or translate Patient 1's summary -> 403
    other_trans = other_patient_client.get(f"/api/v1/analyses/{analysis_id}/patient-summary/translate?lang=hi")
    assert other_trans.status_code == 403

    # Patient 1 translates their own approved summary to Hindi
    hi_resp = patient_client.get(f"/api/v1/analyses/{analysis_id}/patient-summary/translate?lang=hi")
    assert hi_resp.status_code == 200
    data = hi_resp.json()
    assert data["analysis_id"] == analysis_id
    assert "महत्वपूर्ण सूचना" in data["disclaimer"]
    assert len(data["medicines_schedule"]) >= 1

    # Second call hits persistent cache
    cached_resp = patient_client.get(f"/api/v1/analyses/{analysis_id}/patient-summary/translate?lang=hi")
    assert cached_resp.status_code == 200
    assert cached_resp.json()["analysis_id"] == analysis_id


def test_register_patient_success(unauthenticated_client, db_session):
    resp = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={
            "name": "Alice Newman",
            "email": "alice.newman@example.com",
            "password": "SecurePassword123!",
            "role": "patient",
            "age": 42,
            "sex": "Female",
            "allergies": ["Penicillin", "Sulfa drugs"],
            "conditions": ["Asthma"],
            "notes": "Patient notes"
        }
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["user"]["email"] == "alice.newman@example.com"
    assert data["user"]["role"] == "patient"
    assert "token" in data
    assert "meddrag_token" in resp.cookies

    # Verify PatientProfile in DB
    user_id = data["user"]["id"]
    from app.models.entities import PatientProfile
    prof = db_session.query(PatientProfile).filter(PatientProfile.user_id == user_id).first()
    assert prof is not None
    assert prof.age == 42
    assert "Penicillin" in prof.allergies


def test_register_doctor_success(unauthenticated_client):
    resp = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={
            "name": "Dr. Marcus Rivera, MD",
            "email": "dr.rivera@meddrag.hospital",
            "password": "DoctorSecretPass123!",
            "role": "doctor"
        }
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["user"]["email"] == "dr.rivera@meddrag.hospital"
    assert data["user"]["role"] == "doctor"
    assert "token" in data
    assert "meddrag_token" in resp.cookies


def test_register_duplicate_email_fails(unauthenticated_client):
    # Attempt to register with existing email (dr.chen@meddrag.hospital seeded in conftest)
    resp = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={
            "name": "Duplicate User",
            "email": "dr.chen@meddrag.hospital",
            "password": "Password123!",
            "role": "doctor"
        }
    )
    assert resp.status_code == 400
    assert "already exists" in resp.json()["detail"]


def test_register_short_password_fails(unauthenticated_client):
    resp = unauthenticated_client.post(
        "/api/v1/auth/register",
        json={
            "name": "Short Pass User",
            "email": "short.pass@example.com",
            "password": "123",
            "role": "patient"
        }
    )
    assert resp.status_code == 422


