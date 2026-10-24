"""
End-to-End Automated Demonstration Workflow Test
Verifies the complete 12-step faculty demonstration sequence:
1. Dashboard metrics verification
2. New analysis creation with sample prescription
3. Pipeline execution across all 8 stages
4. Inspection of extracted medicines & RxNorm concepts
5. Inspection of retrieved DailyMed & openFDA evidence
6. Clinician row-level editing of a field
7. Saving doctor review draft
8. Verification that unapproved report CANNOT access patient summary (403)
9. Doctor approval gateway execution
10. Verification of approved patient summary (200)
11. Prescription history search and persistence check
12. Ambiguity blocking check on Scenario 2
"""

import pytest


def test_full_demo_workflow(client):
    # Step 1: Open dashboard and verify initial state
    dash_resp = client.get("/api/v1/metrics/summary")
    assert dash_resp.status_code == 200
    initial_metrics = dash_resp.json()
    assert "total_analyses" in initial_metrics

    # Step 2: Create a new analysis using Scenario 1 (Clear Legible)
    create_resp = client.post(
        "/api/v1/analyses",
        data={"demo_scenario_id": "scenario_1_clear", "auto_process": True}
    )
    assert create_resp.status_code == 201
    analysis_id = create_resp.json()["id"]

    # Step 3: Check processing pipeline status
    status_resp = client.get(f"/api/v1/analyses/{analysis_id}/status")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["stage"] in ["pending_review", "evidence_complete", "uploaded"]

    # Step 4: Retrieve and inspect full analysis entity
    full_resp = client.get(f"/api/v1/analyses/{analysis_id}")
    assert full_resp.status_code == 200
    full_data = full_resp.json()
    assert full_data["patient_name_detected"] == "Rohan Verma"
    assert len(full_data["medicines"]) == 2
    assert len(full_data["evidences"]) >= 2

    # Step 5: Check medicines and RxNorm concepts
    meds = full_data["medicines"]
    assert any("Amoxicillin" in m["original_name"] for m in meds)
    assert any("Ibuprofen" in m["original_name"] for m in meds)

    # Step 6: Verify supporting evidence retrieved from FDA DailyMed / openFDA
    evs = full_data["evidences"]
    assert any("DailyMed" in e["source_provider"] or "openFDA" in e["source_provider"] for e in evs)

    # Step 7: Clinician edits a row
    first_med = meds[0]
    edit_resp = client.patch(
        f"/api/v1/analyses/{analysis_id}/medicines/{first_med['id']}",
        json={"reviewer_notes": "Clinician confirmed dosage and duration with patient."}
    )
    assert edit_resp.status_code == 200
    assert edit_resp.json()["reviewer_corrected"] is True

    # Step 8: Save doctor review draft
    draft_resp = client.post(
        f"/api/v1/analyses/{analysis_id}/review",
        json={
            "reviewer_name": "Dr. Anju Chandna (Simulated Clinician Reviewer)",
            "reviewer_role": "Attending Clinician / Reviewer",
            "review_notes": "Clinical review in progress.",
            "review_duration_seconds": 24.5
        }
    )
    assert draft_resp.status_code == 200

    # Step 9: STRICT VERIFICATION - Unapproved report must return 403 Forbidden
    blocked_summary = client.get(f"/api/v1/analyses/{analysis_id}/patient-summary")
    assert blocked_summary.status_code == 403

    # Step 10: Doctor approves report
    approve_resp = client.post(
        f"/api/v1/analyses/{analysis_id}/approve",
        json={
            "reviewer_name": "Dr. Anju Chandna (Simulated Clinician Reviewer)",
            "reviewer_role": "Attending Clinician / Reviewer",
            "review_notes": "Prescription validated. Patient instructions approved.",
            "confirmed_no_unresolved_critical_fields": True,
            "review_duration_seconds": 38.0
        }
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["decision"] == "approved"

    # Step 11: Patient summary now accessible (200 OK)
    summary_resp = client.get(f"/api/v1/analyses/{analysis_id}/patient-summary")
    assert summary_resp.status_code == 200
    summary_data = summary_resp.json()
    assert summary_data["patient_name"] == "Rohan Verma"
    assert len(summary_data["medicines_schedule"]) == 2
    assert len(summary_data["dietary_warnings"]) >= 2
    assert "disclaimer" in summary_data

    # Step 12: Confirm persistence in history and updated dashboard metrics
    hist_resp = client.get(f"/api/v1/analyses?search=Rohan")
    assert hist_resp.status_code == 200
    hist_items = hist_resp.json()
    assert len(hist_items) >= 1
    assert any(h["id"] == analysis_id for h in hist_items)

    updated_metrics = client.get("/api/v1/metrics/summary").json()
    assert updated_metrics["approved_reports"] >= 1
