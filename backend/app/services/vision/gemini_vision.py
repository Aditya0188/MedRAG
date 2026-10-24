import json
import logging
import os
import time
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.core.config import settings

logger = logging.getLogger(__name__)


class VisionMedicineItem(BaseModel):
    original_name: str = Field(description="Exact medicine/drug name as written on the prescription")
    possible_generic_name: Optional[str] = Field(default=None, description="Generic chemical or international nonproprietary name (INN) if known")
    strength: Optional[str] = Field(default=None, description="Exact strength written, e.g. '500mg', '20mg', '650mg', '5ml'")
    dosage: Optional[str] = Field(default=None, description="Dosage form written, e.g. '1 tablet', '1 capsule', '5 ml', '2 drops'")
    route: Optional[str] = Field(default="oral", description="Route of administration, e.g. 'oral', 'topical', 'ophthalmic'")
    frequency_as_written: Optional[str] = Field(default=None, description="Exact frequency written e.g. 'TDS', 'BD', '1-0-1', 'OD', 'QID', 'HS'")
    frequency_meaning: Optional[str] = Field(default=None, description="Standard expansion: 'Three times daily', 'Twice daily', 'Once daily at bedtime', etc.")
    duration_as_written: Optional[str] = Field(default=None, description="Duration e.g. '5 days', '10 days', '1 month'")
    timing_as_written: Optional[str] = Field(default=None, description="Timing symbol e.g. 'pc (after food)', 'ac (before food)', 'HS (bedtime)'")
    food_instructions_as_written: Optional[str] = Field(default=None, description="Any explicit food instruction, e.g. 'take after meals', 'empty stomach'")
    confidence: float = Field(default=0.85, description="Confidence in transcription clarity between 0.0 and 1.0")
    uncertainty_flags: List[str] = Field(default_factory=list, description="Flags like 'unclear_handwriting', 'ambiguous_strength', 'illegible_frequency'")


class VisionExtractionOutput(BaseModel):
    patient_name: Optional[str] = None
    prescriber_name: Optional[str] = None
    prescription_date: Optional[str] = None
    medicines: List[VisionMedicineItem] = Field(default_factory=list, description="Complete list of ALL prescribed medicines on the document without omission")
    raw_text: str = Field(default="", description="Complete verbatim transcription of all text detected on the prescription")
    warnings_or_annotations: List[str] = Field(default_factory=list)
    unreadable_regions: List[str] = Field(default_factory=list)
    overall_quality_assessment: str = ""
    requires_doctor_review: bool = True


VISION_SYSTEM_INSTRUCTION = """
You are an advanced medical vision AI specializing in reading and transcribing handwritten outpatient prescriptions, clinic slips, and hospital medication charts with high fidelity.

CRITICAL EXTRACTION MANDATES:
1. EXTRACT ALL MEDICATIONS: You must identify and transcribe EVERY SINGLE prescribed medicine, drug, tablet, capsule, syrup, injection, drop, or ointment listed on the prescription document. DO NOT stop after 1 or 2 items. If there are 3, 4, 5, 6, 7 or more medications on the page, you MUST extract every single one of them as a separate item in the `medicines` array.
2. STRICT TRANSCRIPTION ACCURACY: Extract exactly what is written on the document. Do not guess or substitute medicines.
3. PRESERVE MEDICAL ABBREVIATIONS: Record the exact abbreviation written (e.g., 'TDS', 'BD', 'OD', '1-0-1', 'pc', 'ac', 'HS', 'SOS', 'stat') in frequency_as_written, and provide the clear clinical expansion in frequency_meaning.
4. AMBIGUOUS OR ILLEGIBLE HANDWRITING: If handwriting for a medicine or dose is smudged, unclear, or cut off, preserve the best reading, assign confidence below 0.60, and add "unclear_handwriting" to uncertainty_flags.
5. NO UNSUPPORTED CLINICAL CLAIMS: Do not invent missing dosages or declare whether a medicine is clinically appropriate.
6. OUTPUT FORMAT: Return strictly valid JSON conforming to the VisionExtractionOutput schema.
"""


def extract_prescription_with_gemini(file_path: str) -> VisionExtractionOutput:
    """
    Calls Google GenAI SDK with Gemini Vision multimodal model to analyze uploaded prescription.
    Extracts all medicines present on the document.
    """
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError(
            "Gemini API Key is not configured. Please enter your Gemini API Key in Settings or set GEMINI_API_KEY in .env."
        )

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    # Determine mime type
    mime_type = "image/jpeg"
    lower_path = file_path.lower()
    if lower_path.endswith(".png"):
        mime_type = "image/png"
    elif lower_path.endswith(".webp"):
        mime_type = "image/webp"
    elif lower_path.endswith(".pdf"):
        mime_type = "application/pdf"

    prompt = (
        "Carefully read and transcribe ALL patient details, doctor details, and every prescribed medication from this medical document. "
        "Make sure to extract EVERY medicine line item (whether there is 1, 2, 3, 5, 8 or more medicines) without omitting any. "
        "Extract fields: original_name, possible_generic_name, strength, dosage, route, frequency_as_written, frequency_meaning, "
        "duration_as_written, timing_as_written, food_instructions_as_written, confidence, and uncertainty_flags."
    )

    max_retries = 3
    delay = 2.0

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=[
                    types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                    prompt
                ],
                config=types.GenerateContentConfig(
                    system_instruction=VISION_SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                    response_schema=VisionExtractionOutput,
                    temperature=0.1,  # Low temperature for factual fidelity
                )
            )

            raw_json_str = response.text
            data_dict = json.loads(raw_json_str)
            validated_output = VisionExtractionOutput(**data_dict)
            logger.info(f"Gemini Vision successfully extracted {len(validated_output.medicines)} medicines from {file_path}")
            return validated_output

        except Exception as e:
            logger.warning(f"Gemini Vision extraction attempt {attempt+1} failed: {str(e)}")
            if attempt < max_retries - 1:
                time.sleep(delay)
                delay *= 2
            else:
                raise RuntimeError(f"Vision model extraction failed after {max_retries} attempts: {str(e)}")
