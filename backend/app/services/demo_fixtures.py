import os
from typing import Dict, Any, List
from PIL import Image, ImageDraw, ImageFont
from app.core.config import settings

DEMO_SCENARIOS: Dict[str, Dict[str, Any]] = {
    "scenario_1_clear": {
        "id": "scenario_1_clear",
        "title": "Scenario 1: Clear Legible Outpatient Prescription",
        "description": "Standard two-drug prescription with clean handwriting, verified RxNorm concepts, and standard dietary timing guidance.",
        "patient_name": "Rohan Verma",
        "prescriber_name": "Dr. Anil Mehrotra, MD (Internal Medicine)",
        "prescription_date": "2026-10-14",
        "filename": "prescription_sample_01_clear.jpg",
        "image_quality_score": 0.94,
        "image_quality_feedback": "Optimal image quality. Sharp cursive strokes, clean contrast, and high resolution.",
        "raw_ocr_baseline": (
            "[Tesseract OCR Baseline]\n"
            "Dr. Anil Mehrotra, MD\n"
            "Pt: Rohan Verma 34M Dt: 14/10/26\n"
            "1. Cap. Amox 500mg TDS x 5d pc\n"
            "2. Tab. Ibuprofen 400mg BD x 3d pc\n"
            "Limitations: Missed exact frequency expansion; no ontological grounding."
        ),
        "raw_ai_text": (
            "Prescription from Dr. Anil Mehrotra, MD. Patient: Rohan Verma, 34/M. "
            "Rx: 1. Cap. Amoxicillin 500mg - 1 capsule three times daily for 5 days after food (pc). "
            "2. Tab. Ibuprofen 400mg - 1 tablet twice daily for 3 days with meals."
        ),
        "medicines": [
            {
                "original_name": "Cap. Amoxicillin",
                "normalized_name": "Amoxicillin 500 MG Oral Capsule",
                "rxcui": "213169",
                "concept_type": "Clinical Drug (SCD)",
                "strength": "500 mg",
                "dosage": "1 capsule",
                "route": "oral",
                "frequency": "TDS",
                "frequency_meaning": "Three times daily",
                "duration": "5 days",
                "timing_instructions": "pc (after food)",
                "food_instructions": "Take with meals or milk if GI upset occurs",
                "extraction_confidence": 0.97,
                "verification_status": "verified_match",
                "uncertainty_flags": [],
                "alternatives_json": [],
                "reviewer_corrected": False,
                "bounding_box": [288.0, 67.0, 363.0, 933.0]
            },
            {
                "original_name": "Tab. Ibuprofen",
                "normalized_name": "Ibuprofen 400 MG Oral Tablet",
                "rxcui": "197806",
                "concept_type": "Clinical Drug (SCD)",
                "strength": "400 mg",
                "dosage": "1 tablet",
                "route": "oral",
                "frequency": "BD",
                "frequency_meaning": "Twice daily",
                "duration": "3 days",
                "timing_instructions": "pc (with meals)",
                "food_instructions": "Take immediately following meals to protect stomach lining",
                "extraction_confidence": 0.96,
                "verification_status": "verified_match",
                "uncertainty_flags": [],
                "alternatives_json": [],
                "reviewer_corrected": False,
                "bounding_box": [375.0, 67.0, 450.0, 933.0]
            }
        ],
        "evidences": [
            {
                "medicine_name": "Amoxicillin",
                "food_or_substance": "Food / Milk",
                "evidence_category": "timing_instruction",
                "source_provider": "DailyMed",
                "source_document_title": "Amoxicillin Capsules USP - FDA DailyMed SPL (Set ID: 947c9448-6a56-4b92-9572-c2834b6bdf63)",
                "source_section": "DOSAGE AND ADMINISTRATION",
                "official_source_url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=947c9448-6a56-4b92-9572-c2834b6bdf63",
                "evidence_excerpt": "Amoxicillin may be taken without regard to meals; however, administration with food, milk, or a light snack may decrease potential gastrointestinal discomfort.",
                "plain_language_summary": "Can be taken with or without food. Taking it with meals or milk can help prevent nausea or stomach irritation.",
                "retrieval_score": 0.95
            },
            {
                "medicine_name": "Ibuprofen",
                "food_or_substance": "Meals & Food",
                "evidence_category": "timing_instruction",
                "source_provider": "openFDA",
                "source_document_title": "Ibuprofen Tablets - FDA Drug Safety Labeling (SPL: a73f6b70-13e5-4e0d-b778-5db604085601)",
                "source_section": "WARNINGS & PRECAUTIONS - GASTROINTESTINAL EFFECTS",
                "official_source_url": "https://api.fda.gov/drug/label.json?search=openfda.generic_name:ibuprofen",
                "evidence_excerpt": "Administration with food or milk is recommended to minimize gastric irritation, nausea, or dyspepsia. Serious gastrointestinal adverse events can occur at any time with NSAIDs.",
                "plain_language_summary": "Always take with food or a glass of milk to protect your stomach lining and prevent gastric ulcers or irritation.",
                "retrieval_score": 0.98
            },
            {
                "medicine_name": "Ibuprofen",
                "food_or_substance": "Alcohol",
                "evidence_category": "avoid_contraindicated",
                "source_provider": "DailyMed",
                "source_document_title": "Ibuprofen Tablet Label - NLM DailyMed",
                "source_section": "ALCOHOL WARNING",
                "official_source_url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=072a71be-dcba-4581-9b16-64fae109dfb3",
                "evidence_excerpt": "Alcohol Warning: If you consume 3 or more alcoholic drinks every day, ask your doctor whether you should take ibuprofen. Ibuprofen may cause severe stomach bleeding.",
                "plain_language_summary": "Do not consume alcohol while taking ibuprofen, as alcohol significantly elevates the risk of acute stomach bleeding.",
                "retrieval_score": 0.92
            }
        ]
    },

    "scenario_2_ambiguous": {
        "id": "scenario_2_ambiguous",
        "title": "Scenario 2: Difficult Handwriting with Ambiguous Item",
        "description": "Prescription with rapid cursive handwriting, an ambiguous medicine name requiring clinician review, and critical food warnings (calcium/dairy 2-hour spacing and grapefruit caution).",
        "patient_name": "Sunita Devi",
        "prescriber_name": "Dr. K. P. Saxena, MBBS, DNB (Cardiology)",
        "prescription_date": "2026-10-18",
        "filename": "prescription_sample_02_ambiguous.jpg",
        "image_quality_score": 0.68,
        "image_quality_feedback": "Moderate quality. Fast cursive strokes detected with ligature ambiguity on Item #3.",
        "raw_ocr_baseline": (
            "[Tesseract OCR Baseline]\n"
            "Dr. K.P. Saxena\n"
            "Pt: Sunita Devi 58F\n"
            "1. Metform 500 BD pc\n"
            "2. Atorva 20 HS\n"
            "3. C?pr... 250 ?\n"
            "CRITICAL OCR FAILURE: Unable to recognize medication #3. Incomplete dosage instruction."
        ),
        "raw_ai_text": (
            "Cardiology outpatient prescription. Patient: Sunita Devi, 58/F. "
            "1. Metformin 500mg BD after meals. "
            "2. Atorvastatin 20mg 1 tab at bedtime (HS). "
            "3. Indistinct cursive line: 'C?pr... 250mg' - High ambiguity between Ciprofloxacin 250mg and Captopril 250mg. Flagged for clinician verification."
        ),
        "medicines": [
            {
                "original_name": "Tab. Metformin",
                "normalized_name": "Metformin hydrochloride 500 MG Oral Tablet",
                "rxcui": "860975",
                "concept_type": "Clinical Drug (SCD)",
                "strength": "500 mg",
                "dosage": "1 tablet",
                "route": "oral",
                "frequency": "BD",
                "frequency_meaning": "Twice daily",
                "duration": "30 days",
                "timing_instructions": "pc (with meals)",
                "food_instructions": "Take with meals",
                "extraction_confidence": 0.94,
                "verification_status": "verified_match",
                "uncertainty_flags": [],
                "alternatives_json": [],
                "reviewer_corrected": False,
                "bounding_box": [288.0, 67.0, 363.0, 933.0]
            },
            {
                "original_name": "Tab. Atorvastatin",
                "normalized_name": "Atorvastatin 20 MG Oral Tablet",
                "rxcui": "259255",
                "concept_type": "Clinical Drug (SCD)",
                "strength": "20 mg",
                "dosage": "1 tablet",
                "route": "oral",
                "frequency": "HS",
                "frequency_meaning": "Once daily at bedtime",
                "duration": "30 days",
                "timing_instructions": "HS (bedtime)",
                "food_instructions": "May take with or without food",
                "extraction_confidence": 0.91,
                "verification_status": "verified_match",
                "uncertainty_flags": [],
                "alternatives_json": [],
                "reviewer_corrected": False,
                "bounding_box": [375.0, 67.0, 450.0, 933.0]
            },
            {
                "original_name": "C?pr... (Unclear Handwriting)",
                "normalized_name": "Ciprofloxacin 250 MG Oral Tablet",
                "rxcui": "309309",
                "concept_type": "Proposed Candidate Match",
                "strength": "250 mg",
                "dosage": "1 tablet",
                "route": "oral",
                "frequency": "BD",
                "frequency_meaning": "Twice daily (proposed)",
                "duration": "5 days",
                "timing_instructions": "Unspecified in handwriting",
                "food_instructions": "Avoid taking concurrently with dairy products",
                "extraction_confidence": 0.44,
                "verification_status": "possible_match",
                "uncertainty_flags": ["unclear_handwriting", "ambiguous_drug_identity", "requires_clinician_disambiguation"],
                "alternatives_json": [
                    {"name": "Ciprofloxacin 250 MG Oral Tablet", "rxcui": "309309", "score": 0.72},
                    {"name": "Captopril 25 MG Oral Tablet", "rxcui": "315486", "score": 0.48}
                ],
                "reviewer_corrected": False,
                "bounding_box": [463.0, 67.0, 538.0, 933.0]
            }
        ],
        "evidences": [
            {
                "medicine_name": "Atorvastatin",
                "food_or_substance": "Grapefruit Juice",
                "evidence_category": "limit_caution",
                "source_provider": "DailyMed",
                "source_document_title": "Atorvastatin Calcium Tablets - FDA DailyMed SPL",
                "source_section": "DRUG INTERACTIONS - 7.1 CYP3A4 Inhibitors",
                "official_source_url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=2957e8cc-660c-4ec7-9960-93b54cf04975",
                "evidence_excerpt": "Grapefruit juice contains one or more components that inhibit CYP3A4 and can increase plasma concentrations of atorvastatin. Concomitant intake of large quantities of grapefruit juice (>1 quart daily) resulted in a 2.5-fold increase in AUC of atorvastatin, increasing the risk of myopathy and rhabdomyolysis.",
                "plain_language_summary": "Avoid drinking large amounts of grapefruit juice. Grapefruit blocks enzymes that break down atorvastatin, leading to dangerously high drug levels and muscle damage.",
                "retrieval_score": 0.96
            },
            {
                "medicine_name": "Metformin",
                "food_or_substance": "Heavy Alcohol Consumption",
                "evidence_category": "avoid_contraindicated",
                "source_provider": "openFDA",
                "source_document_title": "Metformin Hydrochloride Tablets - FDA Black Box Warning & Label",
                "source_section": "BOXED WARNING - LACTIC ACIDOSIS",
                "official_source_url": "https://api.fda.gov/drug/label.json?search=openfda.generic_name:metformin",
                "evidence_excerpt": "Alcohol is known to potentiate the effect of metformin on lactate metabolism. Warn patients against excessive alcohol intake, both acute and chronic, while receiving metformin hydrochloride.",
                "plain_language_summary": "Strictly avoid heavy or binge alcohol intake. Alcohol combined with metformin significantly increases the risk of lactic acidosis, a rare but life-threatening metabolic emergency.",
                "retrieval_score": 0.99
            },
            {
                "medicine_name": "Ciprofloxacin",
                "food_or_substance": "Milk, Yogurt, and Calcium-rich Foods",
                "evidence_category": "timing_instruction",
                "source_provider": "DailyMed",
                "source_document_title": "Ciprofloxacin Tablets USP - FDA DailyMed SPL (Set ID: d7291a92-d6cb-4024-8b83-a4c0eb32c451)",
                "source_section": "FOOD INTERACTIONS & ABSORPTION",
                "official_source_url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d7291a92-d6cb-4024-8b83-a4c0eb32c451",
                "evidence_excerpt": "Ciprofloxacin should be administered at least 2 hours before or 6 hours after calcium-rich foods (such as milk, yogurt, or calcium-fortified juice) or antacids. Calcium chelates with ciprofloxacin, decreasing its oral absorption by up to 50%.",
                "plain_language_summary": "Do NOT take with milk, yogurt, or calcium-rich juices. Space dairy products by at least 2 hours before or 6 hours after taking ciprofloxacin, as calcium blocks absorption.",
                "retrieval_score": 0.97
            }
        ]
    },

    "scenario_3_no_warning": {
        "id": "scenario_3_no_warning",
        "title": "Scenario 3: Medicine with No Clinically Significant Food Warnings",
        "description": "Prescription containing Cetirizine where official FDA documentation confirms no restrictive food or beverage interactions, demonstrating the 'No relevant warning' evidence category.",
        "patient_name": "Deepak Sharma",
        "prescriber_name": "Dr. Sunita Rao, MD (Dermatology & Allergy)",
        "prescription_date": "2026-10-21",
        "filename": "prescription_sample_03_no_warning.jpg",
        "image_quality_score": 0.91,
        "image_quality_feedback": "High clarity, legible printed-style doctor handwriting.",
        "raw_ocr_baseline": (
            "[Tesseract OCR Baseline]\n"
            "Dr. Sunita Rao, MD\n"
            "Pt: Deepak Sharma 29M\n"
            "1. Tab. Cetirizine 10mg OD HS x 7d\n"
            "Result: Partially read line; lacks food interaction ontology."
        ),
        "raw_ai_text": (
            "Allergy and dermatology consultation. Patient: Deepak Sharma, 29/M. "
            "Rx: Tab. Cetirizine 10mg - 1 tablet once daily at bedtime (HS) for 7 days."
        ),
        "medicines": [
            {
                "original_name": "Tab. Cetirizine",
                "normalized_name": "Cetirizine hydrochloride 10 MG Oral Tablet",
                "rxcui": "1011482",
                "concept_type": "Clinical Drug (SCD)",
                "strength": "10 mg",
                "dosage": "1 tablet",
                "route": "oral",
                "frequency": "OD",
                "frequency_meaning": "Once daily",
                "duration": "7 days",
                "timing_instructions": "HS (at bedtime)",
                "food_instructions": "May be taken with or without food",
                "extraction_confidence": 0.98,
                "verification_status": "verified_match",
                "uncertainty_flags": [],
                "alternatives_json": [],
                "reviewer_corrected": False
            }
        ],
        "evidences": [
            {
                "medicine_name": "Cetirizine",
                "food_or_substance": "General Diet / Food",
                "evidence_category": "no_relevant_warning",
                "source_provider": "DailyMed",
                "source_document_title": "Cetirizine Hydrochloride Tablets USP - FDA DailyMed SPL",
                "source_section": "CLINICAL PHARMACOLOGY - PHARMACOKINETICS",
                "official_source_url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=df1a88b5-cf58-45e8-b76b-741a27dfa607",
                "evidence_excerpt": "Cetirizine may be administered with or without food. Food has no significant effect on the extent of cetirizine absorption (AUC), although a slight decrease in peak concentration (Cmax) and delay in Tmax may occur.",
                "plain_language_summary": "Official FDA drug documentation confirms that food does not alter the clinical effectiveness of cetirizine. It may safely be taken with or without meals.",
                "retrieval_score": 0.88
            }
        ]
    }
}


def generate_sample_prescription_image(scenario_key: str, dest_path: str):
    """
    Renders an authentic, high-resolution simulated handwritten prescription image
    with clinic header, Rx insignia, handwriting annotations, and doctor stamp.
    """
    data = DEMO_SCENARIOS.get(scenario_key)
    if not data:
        return

    # Image canvas: warm clinical paper background
    width, height = 1200, 1600
    img = Image.new("RGB", (width, height), color=(248, 246, 240))
    draw = ImageDraw.Draw(img)

    # Clinic Header border
    draw.rectangle([50, 50, width - 50, height - 50], outline=(200, 195, 185), width=2)
    draw.rectangle([54, 54, width - 54, height - 54], outline=(225, 220, 210), width=1)

    # Top Header banner
    draw.line([50, 230, width - 50, 230], fill=(49, 92, 76), width=3)

    # Prescriber info
    doc_name = data["prescriber_name"]
    draw.text((80, 80), doc_name.upper(), fill=(32, 39, 34))
    draw.text((80, 120), "CONSULTANT PHYSICIAN - OUTPATIENT CLINIC", fill=(80, 90, 85))
    draw.text((80, 150), "Galgotias Medical Research Institute, Greater Noida (UP)", fill=(110, 120, 115))
    draw.text((80, 180), "Reg. No: GCET/UP-MED/2026-4409 | Ph: +91 120 2320000", fill=(110, 120, 115))

    # Patient info box
    draw.rectangle([80, 250, width - 80, 340], fill=(242, 240, 232), outline=(215, 210, 200), width=1)
    pt_name = data["patient_name"]
    p_date = data["prescription_date"]
    draw.text((100, 270), f"Patient: {pt_name}", fill=(32, 39, 34))
    draw.text((500, 270), "Age/Sex: Adult", fill=(80, 90, 85))
    draw.text((850, 270), f"Date: {p_date}", fill=(32, 39, 34))
    draw.text((100, 305), "OPD ID: OPD-2026-8819", fill=(110, 120, 115))
    draw.text((500, 305), "Vitals: BP 124/82 mmHg | SpO2 98%", fill=(110, 120, 115))

    # Rx Symbol
    draw.text((85, 370), "Rx", fill=(49, 92, 76))
    draw.line([85, 420, 135, 420], fill=(49, 92, 76), width=2)

    # Prescription items (rendered with handwritten appearance)
    y_pos = 460
    for i, med in enumerate(data["medicines"], start=1):
        # Draw light notebook ruling lines
        draw.line([80, y_pos + 45, width - 80, y_pos + 45], fill=(230, 226, 218), width=1)
        draw.line([80, y_pos + 95, width - 80, y_pos + 95], fill=(230, 226, 218), width=1)

        # Medication line
        med_line = f"{i}. {med['original_name']}   {med['strength'] or ''}"
        draw.text((100, y_pos), med_line, fill=(20, 30, 25))

        # Instructions / Sig line
        sig_line = f"    Sig: {med['dosage'] or '1 dose'} -- {med['frequency']}  x  {med['duration']}   [{med['timing_instructions'] or ''}]"
        draw.text((100, y_pos + 50), sig_line, fill=(35, 45, 40))

        y_pos += 140

    # General instructions
    draw.line([80, y_pos + 40, width - 80, y_pos + 40], fill=(200, 195, 185), width=1)
    y_pos += 60
    draw.text((100, y_pos), "Notes / Advice:", fill=(60, 70, 65))
    draw.text((100, y_pos + 35), "- Drink adequate water (2.5L/day).", fill=(70, 80, 75))
    draw.text((100, y_pos + 70), "- Review in OPD after completion of medication course.", fill=(70, 80, 75))

    # Footer Stamp and Signature
    draw.line([50, height - 200, width - 50, height - 200], fill=(215, 210, 200), width=1)
    draw.text((80, height - 170), "For clinical inquiries: opd@gcet-hospital.edu.in", fill=(120, 130, 125))
    draw.text((80, height - 140), "Generated for Academic Evaluation - BTech Data Science 2026", fill=(140, 150, 145))

    # Doctor signature simulation
    draw.line([width - 380, height - 140, width - 100, height - 140], fill=(80, 90, 85), width=2)
    draw.text((width - 340, height - 180), "Dr. Mehrotra", fill=(30, 45, 60))
    draw.text((width - 340, height - 130), "Authorized Prescriber Signature", fill=(110, 120, 115))

    # Save image
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    img.save(dest_path, "JPEG", quality=92)


def seed_sample_prescriptions():
    """Generates all 3 sample prescription images on disk if missing."""
    for key, sc in DEMO_SCENARIOS.items():
        dest = os.path.join(settings.SAMPLES_DIR, sc["filename"])
        if not os.path.exists(dest):
            generate_sample_prescription_image(key, dest)
