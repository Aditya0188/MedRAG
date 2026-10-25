import asyncio
import io
import json
import logging
import os
import time
from typing import List, Optional, Dict, Any
from PIL import Image, ImageOps
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
    bounding_box: Optional[List[float]] = Field(
        default=None,
        description="Normalized bounding box [ymin, xmin, ymax, xmax] on a 0-1000 scale covering where this medicine line appears. Null if unlocatable."
    )


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
4. BOUNDING BOX LOCALIZATION: For each medicine, provide a normalized bounding box [ymin, xmin, ymax, xmax] on a 0-1000 integer scale enclosing the handwritten line or printed entry for that medicine on the document. If the location cannot be reliably determined, output null for bounding_box.
5. AMBIGUOUS OR ILLEGIBLE HANDWRITING: If handwriting for a medicine or dose is smudged, unclear, or cut off, preserve the best reading, assign confidence below 0.60, and add "unclear_handwriting" to uncertainty_flags.
6. NO UNSUPPORTED CLINICAL CLAIMS: Do not invent missing dosages or declare whether a medicine is clinically appropriate.
7. OUTPUT FORMAT: Return strictly valid JSON conforming to the VisionExtractionOutput schema.
"""


def _call_gemini_vision_single(client, file_bytes: bytes, mime_type: str, candidate_models: List[str]) -> VisionExtractionOutput:
    from google.genai import types

    prompt = (
        "Carefully read and transcribe ALL patient details, doctor details, and every prescribed medication from this medical document. "
        "Make sure to extract EVERY medicine line item (whether there is 1, 2, 3, 5, 8 or more medicines) without omitting any. "
        "For each medicine, include the normalized bounding box [ymin, xmin, ymax, xmax] on a 0-1000 scale. If not determinable, set bounding_box to null. "
        "Extract fields: original_name, possible_generic_name, strength, dosage, route, frequency_as_written, frequency_meaning, "
        "duration_as_written, timing_as_written, food_instructions_as_written, confidence, uncertainty_flags, and bounding_box."
    )

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
            if raw_json_str.startswith("```"):
                lines = raw_json_str.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                raw_json_str = "\n".join(lines).strip()

            data_dict = json.loads(raw_json_str)
            validated_output = VisionExtractionOutput(**data_dict)
            logger.info(f"Gemini Vision successfully extracted {len(validated_output.medicines)} medicines using model {model_name}")
            return validated_output

        except Exception as e:
            last_error = e
            logger.warning(f"Model '{model_name}' failed: {e}; falling to next candidate model immediately.")
            continue

    raise RuntimeError(f"Vision model extraction failed across all candidate models: {str(last_error)}")


async def extract_prescription_with_gemini(file_path: str) -> VisionExtractionOutput:
    """
    Calls Google GenAI SDK with Gemini Vision multimodal model to analyze uploaded prescription.
    Downscales large images in-memory to max 1600px (keeping original intact on disk for display).
    Processes multi-page PDFs concurrently.
    """
    api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError(
            "Gemini API Key is not configured. Please enter your Gemini API Key in Settings or set GEMINI_API_KEY in .env."
        )

    from google import genai
    client = genai.Client(api_key=api_key)

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

    lower_path = file_path.lower()

    # 1. Multi-Page PDF Handling (process pages concurrently)
    if lower_path.endswith(".pdf"):
        try:
            from pypdf import PdfReader, PdfWriter
            reader = PdfReader(file_path)
            num_pages = len(reader.pages)
            if num_pages > 1:
                logger.info(f"Processing multi-page PDF ({num_pages} pages) concurrently...")
                page_payloads = []
                for page in reader.pages:
                    writer = PdfWriter()
                    writer.add_page(page)
                    buf = io.BytesIO()
                    writer.write(buf)
                    page_payloads.append(buf.getvalue())

                # Run extraction for each page concurrently
                tasks = [
                    asyncio.to_thread(_call_gemini_vision_single, client, p_bytes, "application/pdf", candidate_models)
                    for p_bytes in page_payloads
                ]
                page_results = await asyncio.gather(*tasks, return_exceptions=True)

                merged_medicines = []
                merged_raw_texts = []
                first_valid: Optional[VisionExtractionOutput] = None

                for idx, res in enumerate(page_results):
                    if isinstance(res, VisionExtractionOutput):
                        if first_valid is None:
                            first_valid = res
                        merged_medicines.extend(res.medicines)
                        if res.raw_text:
                            merged_raw_texts.append(f"--- Page {idx + 1} ---\n{res.raw_text}")
                    else:
                        logger.warning(f"PDF page {idx + 1} extraction failed: {res}")

                if first_valid:
                    first_valid.medicines = merged_medicines
                    first_valid.raw_text = "\n\n".join(merged_raw_texts)
                    return first_valid
                else:
                    raise RuntimeError("All PDF pages failed extraction.")
        except Exception as pdf_err:
            logger.warning(f"Concurrent PDF page extraction fallback to single payload: {pdf_err}")

        # Fallback to single PDF file read
        with open(file_path, "rb") as f:
            pdf_bytes = f.read()
        return await asyncio.to_thread(_call_gemini_vision_single, client, pdf_bytes, "application/pdf", candidate_models)

    # 2. Image Handling (Downscale in-memory max 1600px long side, original preserved on disk)
    try:
        img = Image.open(file_path)
        img = ImageOps.exif_transpose(img)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        max_dim = max(img.size)
        if max_dim > 1600:
            scale = 1600.0 / max_dim
            new_size = (int(img.width * scale), int(img.height * scale))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=88, optimize=True)
        img_bytes = buf.getvalue()
        mime_type = "image/jpeg"
    except Exception as img_err:
        logger.warning(f"Image preprocessing fallback to raw read: {img_err}")
        with open(file_path, "rb") as f:
            img_bytes = f.read()
        mime_type = "image/png" if lower_path.endswith(".png") else "image/jpeg"

    return await asyncio.to_thread(_call_gemini_vision_single, client, img_bytes, mime_type, candidate_models)
