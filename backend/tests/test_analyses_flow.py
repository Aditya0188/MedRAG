import io
from PIL import Image


def test_create_and_process_scenario_1(client):
    # 1. Create analysis using demo Scenario 1
    resp = client.post("/api/v1/analyses", data={"demo_scenario_id": "scenario_1_clear", "auto_process": True})
    assert resp.status_code == 201
    analysis_data = resp.json()
    analysis_id = analysis_data["id"]
    assert analysis_data["is_demo"] is True

    # Check status
    status_resp = client.get(f"/api/v1/analyses/{analysis_id}/status")
    assert status_resp.status_code == 200

    # Retrieve full analysis
    full_resp = client.get(f"/api/v1/analyses/{analysis_id}")
    assert full_resp.status_code == 200
    full_data = full_resp.json()
    assert full_data["patient_name_detected"] == "Rohan Verma"
    assert len(full_data["medicines"]) == 2
    assert len(full_data["evidences"]) >= 2

    # Verify patient summary is BLOCKED (403) before approval
    patient_sum_resp = client.get(f"/api/v1/analyses/{analysis_id}/patient-summary")
    assert patient_sum_resp.status_code == 403

    # Row-level editing: Doctor updates a medicine instruction
    first_med_id = full_data["medicines"][0]["id"]
    patch_resp = client.patch(
        f"/api/v1/analyses/{analysis_id}/medicines/{first_med_id}",
        json={"reviewer_notes": "Verified by Dr. Chandna: continue 5 full days."}
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["reviewer_corrected"] is True

    # Doctor Approves
    approve_resp = client.post(
        f"/api/v1/analyses/{analysis_id}/approve",
        json={
            "reviewer_name": "Dr. Anju Chandna (Simulated Reviewer)",
            "reviewer_role": "Attending Clinician / Reviewer",
            "review_notes": "All medications verified and approved.",
            "confirmed_no_unresolved_critical_fields": True
        }
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["decision"] == "approved"

    # Now Patient Summary is ACCESSIBLE (200)
    approved_sum_resp = client.get(f"/api/v1/analyses/{analysis_id}/patient-summary")
    assert approved_sum_resp.status_code == 200
    sum_data = approved_sum_resp.json()
    assert sum_data["patient_name"] == "Rohan Verma"
    assert len(sum_data["medicines_schedule"]) == 2
    assert len(sum_data["dietary_warnings"]) >= 2
    assert "disclaimer" in sum_data


def test_scenario_2_ambiguity_blocks_approval_until_corrected(client):
    # Scenario 2 has an ambiguous cursive medicine (C?pr... 250mg)
    resp = client.post("/api/v1/analyses", data={"demo_scenario_id": "scenario_2_ambiguous", "auto_process": True})
    assert resp.status_code == 201
    analysis_id = resp.json()["id"]

    full_resp = client.get(f"/api/v1/analyses/{analysis_id}")
    full_data = full_resp.json()
    ambiguous_med = next((m for m in full_data["medicines"] if "unclear_handwriting" in m["uncertainty_flags"]), None)
    assert ambiguous_med is not None

    # Attempting to approve while ambiguous handwriting is uncorrected MUST FAIL (400)
    fail_approve_resp = client.post(
        f"/api/v1/analyses/{analysis_id}/approve",
        json={
            "reviewer_name": "Dr. Reviewer",
            "reviewer_role": "Attending Clinician",
            "review_notes": "Attempting premature approval without verifying blurred item."
        }
    )
    assert fail_approve_resp.status_code == 400
    assert "Approval blocked" in fail_approve_resp.json()["detail"]

    # Clinician resolves ambiguity by editing the row
    correct_resp = client.patch(
        f"/api/v1/analyses/{analysis_id}/medicines/{ambiguous_med['id']}",
        json={
            "original_name": "Tab. Ciprofloxacin 250mg",
            "normalized_name": "Ciprofloxacin 250 MG Oral Tablet",
            "rxcui": "309309",
            "verification_status": "verified_match",
            "reviewer_notes": "Disambiguated from blurred handwriting as Ciprofloxacin 250mg by attending doctor."
        }
    )
    assert correct_resp.status_code == 200

    # Now approval MUST SUCCEED
    success_approve = client.post(
        f"/api/v1/analyses/{analysis_id}/approve",
        json={
            "reviewer_name": "Dr. Anju Chandna (Simulated Reviewer)",
            "reviewer_role": "Attending Clinician",
            "review_notes": "All lines disambiguated and verified."
        }
    )
    assert success_approve.status_code == 200
    assert success_approve.json()["decision"] == "approved"


def test_dashboard_metrics(client):
    resp = client.get("/api/v1/metrics/summary")
    assert resp.status_code == 200
    metrics = resp.json()
    assert metrics["total_analyses"] >= 2
    assert metrics["approved_reports"] >= 1
    assert "recent_analyses" in metrics
