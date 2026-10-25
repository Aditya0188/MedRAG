"""
Idempotent seed script for MedDRAG.
Seeds 2 doctors and 4 synthetic patients with demo accounts, profiles,
sample analyses (approved, pending, rejected), and audit log entries.

Run with:
  cd backend && python -m app.seed
  or
  python -m app.seed
"""

import sys
import os
from datetime import datetime, timezone, timedelta

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import engine, Base, SessionLocal, run_sqlite_migrations
from app.models.entities import User, PatientProfile, Analysis, ExtractedMedicine, Evidence, Review, AuditEvent
from app.core.auth import hash_password
from app.services.pipeline_orchestrator import add_audit_log

DEMO_PASSWORD = "DemoPassword123!"


def utc_now():
    return datetime.now(timezone.utc)


def seed():
    print("Running database migrations and table creation...")
    Base.metadata.create_all(bind=engine)
    run_sqlite_migrations(engine)

    db = SessionLocal()
    try:
        pw_hash = hash_password(DEMO_PASSWORD)

        # -------------------------------------------------------------
        # 1. Seed Doctors
        # -------------------------------------------------------------
        doctors_data = [
            {
                "email": "dr.chen@meddrag.hospital",
                "name": "Dr. Sarah Chen, MD",
                "role": "doctor"
            },
            {
                "email": "dr.sharma@meddrag.hospital",
                "name": "Dr. Rajesh Sharma, MD",
                "role": "doctor"
            }
        ]

        doctors = {}
        for doc in doctors_data:
            user = db.query(User).filter(User.email == doc["email"]).first()
            if not user:
                user = User(
                    name=doc["name"],
                    email=doc["email"],
                    password_hash=pw_hash,
                    role="doctor",
                    created_at=utc_now() - timedelta(days=30)
                )
                db.add(user)
                db.flush()
                print(f"Created doctor: {doc['name']} ({doc['email']})")
            else:
                user.password_hash = pw_hash
                user.name = doc["name"]
            doctors[doc["email"]] = user

        # -------------------------------------------------------------
        # 2. Seed Patients & Patient Profiles
        # -------------------------------------------------------------
        patients_data = [
            {
                "email": "john.miller@example.com",
                "name": "John Miller",
                "age": 52,
                "sex": "M",
                "allergies": ["Penicillin", "Sulfa drugs"],
                "conditions": ["Hypertension", "Type 2 Diabetes"],
                "notes": "Monitored for renal clearance."
            },
            {
                "email": "priya.patel@example.com",
                "name": "Priya Patel",
                "age": 34,
                "sex": "F",
                "allergies": ["Amoxicillin"],
                "conditions": ["GERD / Acid Reflux"],
                "notes": "Prefers non-NSAID analgesics."
            },
            {
                "email": "marcus.vance@example.com",
                "name": "Marcus Vance",
                "age": 68,
                "sex": "M",
                "allergies": ["Ciprofloxacin"],
                "conditions": ["Atrial Fibrillation", "Hyperlipidemia"],
                "notes": "Strict dietary sodium monitoring."
            },
            {
                "email": "ananya.iyer@example.com",
                "name": "Ananya Iyer",
                "age": 29,
                "sex": "F",
                "allergies": [],
                "conditions": ["Asthma"],
                "notes": "No known drug allergies."
            }
        ]

        patients = {}
        for p in patients_data:
            user = db.query(User).filter(User.email == p["email"]).first()
            if not user:
                user = User(
                    name=p["name"],
                    email=p["email"],
                    password_hash=pw_hash,
                    role="patient",
                    created_at=utc_now() - timedelta(days=20)
                )
                db.add(user)
                db.flush()
                print(f"Created patient: {p['name']} ({p['email']})")
            else:
                user.password_hash = pw_hash
                user.name = p["name"]

            patients[p["email"]] = user

            # Patient profile
            profile = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
            if not profile:
                profile = PatientProfile(
                    user_id=user.id,
                    age=p["age"],
                    sex=p["sex"],
                    allergies=p["allergies"],
                    conditions=p["conditions"],
                    notes=p["notes"]
                )
                db.add(profile)
            else:
                profile.age = p["age"]
                profile.sex = p["sex"]
                profile.allergies = p["allergies"]
                profile.conditions = p["conditions"]
                profile.notes = p["notes"]

        db.commit()

        # -------------------------------------------------------------
        # 3. Seed Realistic Synthetic Prescriptions
        # -------------------------------------------------------------
        dr_chen = doctors["dr.chen@meddrag.hospital"]
        john = patients["john.miller@example.com"]
        marcus = patients["marcus.vance@example.com"]
        ananya = patients["ananya.iyer@example.com"]

        # 3A. Approved Prescription for John Miller
        john_analysis = db.query(Analysis).filter(
            Analysis.patient_id == john.id,
            Analysis.review_status == "approved"
        ).first()

        if not john_analysis:
            john_analysis = Analysis(
                patient_id=john.id,
                reviewed_by=dr_chen.id,
                original_filename="rx_john_miller_outpatient.jpg",
                stored_filepath="./data/samples/sample_rx_01_ambiguity.jpg",
                file_checksum="seed_checksum_john_miller_001",
                created_at=utc_now() - timedelta(days=2),
                stage="approved",
                status="completed",
                is_demo=False,
                patient_name_detected=john.name,
                prescriber_name_detected="Dr. Robert Hayes, MD",
                prescription_date_detected=(utc_now() - timedelta(days=2)).strftime("%Y-%m-%d"),
                total_processing_duration_sec=3.85,
                image_quality_score=0.94,
                image_quality_feedback="High resolution document with clear contrast.",
                review_status="approved",
                reviewed_at=utc_now() - timedelta(days=2, hours=-1)
            )
            db.add(john_analysis)
            db.flush()

            # Medicines for John
            med1 = ExtractedMedicine(
                analysis_id=john_analysis.id,
                original_name="Metformin 500mg",
                normalized_name="Metformin hydrochloride 500 MG Oral Tablet",
                rxcui="860975",
                concept_type="SCD",
                strength="500mg",
                dosage="1 tablet",
                route="oral",
                frequency="Twice daily",
                frequency_meaning="Twice daily with meals (BD)",
                duration="30 days",
                timing_instructions="Take with breakfast and dinner",
                food_instructions="Take with food to minimize GI discomfort",
                extraction_confidence=0.96,
                verification_status="verified_match",
                reviewer_corrected=False,
                bounding_box=[120.0, 50.0, 220.0, 920.0]
            )
            med2 = ExtractedMedicine(
                analysis_id=john_analysis.id,
                original_name="Amlodipine 5mg",
                normalized_name="Amlodipine 5 MG Oral Tablet",
                rxcui="197361",
                concept_type="SCD",
                strength="5mg",
                dosage="1 tablet",
                route="oral",
                frequency="Once daily",
                frequency_meaning="Once daily in the morning (OD)",
                duration="30 days",
                timing_instructions="Morning dose",
                food_instructions="May be taken with or without food",
                extraction_confidence=0.94,
                verification_status="verified_match",
                reviewer_corrected=False,
                bounding_box=[240.0, 50.0, 340.0, 920.0]
            )
            db.add_all([med1, med2])
            db.flush()

            # Evidence for John's medicines
            ev1 = Evidence(
                analysis_id=john_analysis.id,
                medicine_id=med1.id,
                medicine_name="Metformin",
                food_or_substance="Dietary Administration & Alcohol",
                evidence_category="limit_caution",
                source_provider="DailyMed",
                source_document_title="METFORMIN HYDROCHLORIDE tablet (DailyMed SPL)",
                source_section="DOSAGE AND ADMINISTRATION / WARNINGS",
                official_source_url="https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=metformin",
                evidence_excerpt="Administer with meals to reduce gastrointestinal adverse effects. Warn patients against excessive alcohol consumption.",
                plain_language_summary="Take with meals to reduce stomach upset. Strictly limit alcohol intake to avoid lactic acidosis.",
                retrieval_score=0.95,
                retrieval_timestamp=utc_now()
            )
            ev2 = Evidence(
                analysis_id=john_analysis.id,
                medicine_id=med2.id,
                medicine_name="Amlodipine",
                food_or_substance="Grapefruit / Grapefruit Juice",
                evidence_category="limit_caution",
                source_provider="openFDA",
                source_document_title="Amlodipine Besylate FDA Drug Label",
                source_section="DRUG INTERACTIONS",
                official_source_url="https://api.fda.gov/drug/label.json",
                evidence_excerpt="Coadministration of amlodipine with grapefruit or grapefruit juice is not recommended as it may increase bioavailability.",
                plain_language_summary="Avoid consuming large amounts of grapefruit juice, which can abnormally raise blood levels of amlodipine.",
                retrieval_score=0.93,
                retrieval_timestamp=utc_now()
            )
            db.add_all([ev1, ev2])

            # Review record
            rev_john = Review(
                analysis_id=john_analysis.id,
                reviewer_name=dr_chen.name,
                reviewer_role="Attending Clinician / Reviewer",
                decision="approved",
                review_notes="Dosages and clinical instructions verified against OPD card. Safe for patient access.",
                review_duration_seconds=42.0,
                decided_at=john_analysis.reviewed_at
            )
            db.add(rev_john)
            print("Seeded approved prescription for John Miller.")

        # 3B. Pending Review Prescription for Marcus Vance
        marcus_analysis = db.query(Analysis).filter(
            Analysis.patient_id == marcus.id,
            Analysis.review_status == "pending_review"
        ).first()

        if not marcus_analysis:
            marcus_analysis = Analysis(
                patient_id=marcus.id,
                original_filename="rx_marcus_vance_cardiology.jpg",
                stored_filepath="./data/samples/sample_rx_02_multidrug.jpg",
                file_checksum="seed_checksum_marcus_vance_002",
                created_at=utc_now() - timedelta(hours=3),
                stage="pending_review",
                status="completed",
                is_demo=False,
                patient_name_detected=marcus.name,
                prescriber_name_detected="Dr. Anita Desai, Cardiologist",
                prescription_date_detected=utc_now().strftime("%Y-%m-%d"),
                total_processing_duration_sec=4.12,
                image_quality_score=0.88,
                image_quality_feedback="Legible OPD slip with slight ink fading.",
                review_status="pending_review"
            )
            db.add(marcus_analysis)
            db.flush()

            med_m1 = ExtractedMedicine(
                analysis_id=marcus_analysis.id,
                original_name="Atorvastatin 20mg",
                normalized_name="Atorvastatin 20 MG Oral Tablet",
                rxcui="617314",
                concept_type="SCD",
                strength="20mg",
                dosage="1 tablet",
                route="oral",
                frequency="Once daily at bedtime",
                frequency_meaning="Once daily at bedtime (HS)",
                duration="60 days",
                timing_instructions="Take at night before sleep",
                food_instructions="Avoid grapefruit juice",
                extraction_confidence=0.92,
                verification_status="verified_match",
                reviewer_corrected=False,
                bounding_box=[130.0, 60.0, 230.0, 900.0]
            )
            med_m2 = ExtractedMedicine(
                analysis_id=marcus_analysis.id,
                original_name="Ciprofloxacin 250mg",
                normalized_name="Ciprofloxacin 250 MG Oral Tablet",
                rxcui="309309",
                concept_type="SCD",
                strength="250mg",
                dosage="1 tablet",
                route="oral",
                frequency="Twice daily",
                frequency_meaning="Twice daily (BD)",
                duration="5 days",
                timing_instructions="Every 12 hours",
                food_instructions="Do not take with milk or antacids",
                extraction_confidence=0.78,
                verification_status="verified_match",
                uncertainty_flags=["unclear_handwriting"],
                reviewer_corrected=False,
                bounding_box=[250.0, 60.0, 360.0, 900.0]
            )
            db.add_all([med_m1, med_m2])
            print("Seeded pending review prescription for Marcus Vance.")

        # 3C. Rejected Prescription for Ananya Iyer
        ananya_analysis = db.query(Analysis).filter(
            Analysis.patient_id == ananya.id,
            Analysis.review_status == "rejected"
        ).first()

        if not ananya_analysis:
            ananya_analysis = Analysis(
                patient_id=ananya.id,
                reviewed_by=dr_chen.id,
                original_filename="rx_ananya_blurry_slip.jpg",
                stored_filepath="./data/samples/sample_rx_03_regional_brand.jpg",
                file_checksum="seed_checksum_ananya_003",
                created_at=utc_now() - timedelta(days=1),
                stage="rejected",
                status="completed",
                is_demo=False,
                patient_name_detected=ananya.name,
                prescriber_name_detected="Dr. K. Nair, Physician",
                prescription_date_detected=(utc_now() - timedelta(days=1)).strftime("%Y-%m-%d"),
                total_processing_duration_sec=3.2,
                image_quality_score=0.42,
                image_quality_feedback="Motion blur detected; text lines illegible.",
                review_status="rejected",
                rejection_reason="Motion blur and poor lighting render medication names unreadable. Please re-upload a clear, well-lit photo.",
                reviewed_at=utc_now() - timedelta(hours=18)
            )
            db.add(ananya_analysis)
            db.flush()

            rev_ananya = Review(
                analysis_id=ananya_analysis.id,
                reviewer_name=dr_chen.name,
                reviewer_role="Attending Clinician / Reviewer",
                decision="rejected",
                review_notes=ananya_analysis.rejection_reason,
                review_duration_seconds=22.0,
                decided_at=ananya_analysis.reviewed_at
            )
            db.add(rev_ananya)
            print("Seeded rejected prescription for Ananya Iyer.")

        # -------------------------------------------------------------
        # 4. Seed Audit Log Entries (login, upload, edit, approve, reject)
        # -------------------------------------------------------------
        ref_id = john_analysis.id if john_analysis else "system_event"
        add_audit_log(
            db,
            analysis_id=ref_id,
            event_type="login",
            actor=dr_chen.name,
            details={"email": dr_chen.email, "role": "doctor"},
            user_id=dr_chen.id
        )
        add_audit_log(
            db,
            analysis_id=ref_id,
            event_type="upload",
            actor=john.name,
            details={"filename": "rx_john_miller_outpatient.jpg"},
            user_id=john.id
        )
        add_audit_log(
            db,
            analysis_id=ref_id,
            event_type="edit",
            actor=dr_chen.name,
            details={"verified_item": "Metformin 500mg"},
            user_id=dr_chen.id
        )
        add_audit_log(
            db,
            analysis_id=ref_id,
            event_type="approve",
            actor=dr_chen.name,
            details={"review_notes": "Prescription approved."},
            user_id=dr_chen.id
        )
        if ananya_analysis:
            add_audit_log(
                db,
                analysis_id=ananya_analysis.id,
                event_type="reject",
                actor=dr_chen.name,
                details={"reason": ananya_analysis.rejection_reason},
                user_id=dr_chen.id
            )

        db.commit()
        print("\nSeed completed successfully!")
        print("Demo Doctors:")
        print("  - dr.chen@meddrag.hospital / DemoPassword123!")
        print("  - dr.sharma@meddrag.hospital / DemoPassword123!")
        print("Demo Patients:")
        print("  - john.miller@example.com / DemoPassword123! (Approved summary available)")
        print("  - marcus.vance@example.com / DemoPassword123! (Pending review)")
        print("  - ananya.iyer@example.com / DemoPassword123! (Rejected, can re-upload)")
        print("  - priya.patel@example.com / DemoPassword123!")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
