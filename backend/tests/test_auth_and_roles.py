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
