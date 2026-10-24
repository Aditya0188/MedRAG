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
    
    import io
    from PIL import Image

    # Determine mime type and optimize image payload for ultra-fast network transfer & vision latency
    mime_type = "image/jpeg"
    lower_path = file_path.lower()
    if lower_path.endswith(".pdf"):
        mime_type = "application/pdf"
        with open(file_path, "rb") as f:
            file_bytes = f.read()
    else:
        try:
            img = Image.open(file_path)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            # Downscale exceptionally large smartphone photos (> 1600px) while maintaining crisp resolution
            max_dim = max(img.size)
            if max_dim > 1600:
                scale = 1600.0 / max_dim
                new_size = (int(img.width * scale), int(img.height * scale))
                img = img.resize(new_size, Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=88, optimize=True)
            file_bytes = buf.getvalue()
            mime_type = "image/jpeg"
        except Exception:
            with open(file_path, "rb") as f:
                file_bytes = f.read()
            if lower_path.endswith(".png"):
                mime_type = "image/png"
            elif lower_path.endswith(".webp"):
                mime_type = "image/webp"

    prompt = (
        "Carefully read and transcribe ALL patient details, doctor details, and every prescribed medication from this medical document. "
        "Make sure to extract EVERY medicine line item (whether there is 1, 2, 3, 5, 8 or more medicines) without omitting any. "
        "Extract fields: original_name, possible_generic_name, strength, dosage, route, frequency_as_written, frequency_meaning, "
        "duration_as_written, timing_as_written, food_instructions_as_written, confidence, and uncertainty_flags."
    )

    # Fast models ordered by lowest latency (sub-5s) with seamless fallbacks
    fast_fallback_order = [
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash",
        "gemini-flash-lite-latest",
        "gemini-3.8-flash"
    ]
    candidate_models = []
    if settings.GEMINI_MODEL:
        candidate_models.append(settings.GEMINI_MODEL)
    for model_candidate in fast_fallback_order:
        if model_candidate not in candidate_models:
            candidate_models.append(model_candidate)

    last_error = None
    for model_name in candidate_models:
        logger.info(f"Attempting prescription extraction with model '{model_name}'...")
        try:
            response = client.models.generate_content(
                model=model_name,
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

            raw_json_str = response.text.strip()
            # Remove markdown code fences if model enclosed JSON
            if raw_json_str.startswith("```"):
                lines = raw_json_str.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                raw_json_str = "\n".join(lines).strip()

            data_dict = json.loads(raw_json_str)
            validated_output = VisionExtractionOutput(**data_dict)
            logger.info(f"Gemini Vision successfully extracted {len(validated_output.medicines)} medicines from {file_path} using model {model_name}")
            return validated_output

        except Exception as e:
            err_str = str(e)
            last_error = e
            logger.warning(f"Model '{model_name}' failed: {err_str}; falling to next candidate model immediately.")
            continue

    raise RuntimeError(f"Vision model extraction failed across all candidate models: {str(last_error)}")
