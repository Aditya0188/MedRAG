import logging
from typing import Dict, Any, List, Optional
import httpx
from pydantic import BaseModel
from app.core.config import settings

logger = logging.getLogger(__name__)


class RxNormCandidate(BaseModel):
    rxcui: str
    name: str
    term_type: Optional[str] = None  # IN (Ingredient), BN (Brand Name), SCDC, SCD (Semantic Clinical Drug)
    score: float = 1.0


class RxNormVerificationResult(BaseModel):
    query_term: str
    normalized_name: Optional[str] = None
    rxcui: Optional[str] = None
    concept_type: Optional[str] = None
    verification_status: str
    # 'verified_match', 'possible_match', 'no_verified_match', 'unclear_handwriting', 'unsupported_regional_brand'
    candidates: List[RxNormCandidate] = []
    is_regional_brand: bool = False
    regional_brand_note: Optional[str] = None


# Regional Indian Brand Mappings to Generic INNs
# Standard clinical formulary cross-references
INDIAN_BRAND_MAP = {
    "dolo 650": {"generic": "Paracetamol 650 MG", "ingredient": "Acetaminophen", "rxcui": "161"},
    "dolo": {"generic": "Paracetamol", "ingredient": "Acetaminophen", "rxcui": "161"},
    "augmentin": {"generic": "Amoxicillin / Clavulanate", "ingredient": "Amoxicillin and Clavulanate Potassium", "rxcui": "617314"},
    "augmentin 625": {"generic": "Amoxicillin 500 MG / Clavulanate Potassium 125 MG", "ingredient": "Amoxicillin and Clavulanate Potassium", "rxcui": "617314"},
    "pantocid": {"generic": "Pantoprazole", "ingredient": "Pantoprazole", "rxcui": "40790"},
    "pantocid 40": {"generic": "Pantoprazole 40 MG", "ingredient": "Pantoprazole", "rxcui": "284635"},
    "azithral": {"generic": "Azithromycin", "ingredient": "Azithromycin", "rxcui": "18631"},
    "azithral 500": {"generic": "Azithromycin 500 MG", "ingredient": "Azithromycin", "rxcui": "248656"},
    "calpol": {"generic": "Paracetamol", "ingredient": "Acetaminophen", "rxcui": "161"},
    "combiflam": {"generic": "Ibuprofen and Paracetamol", "ingredient": "Ibuprofen and Acetaminophen", "rxcui": "5640"},
    "glycomet": {"generic": "Metformin hydrochloride", "ingredient": "Metformin", "rxcui": "6809"},
    "glycomet 500": {"generic": "Metformin hydrochloride 500 MG", "ingredient": "Metformin", "rxcui": "860975"},
    "atorva": {"generic": "Atorvastatin", "ingredient": "Atorvastatin", "rxcui": "83367"},
    "pan d": {"generic": "Pantoprazole and Domperidone", "ingredient": "Pantoprazole", "rxcui": "40790"}
}

# Cache for API responses to reduce network round-trips
_RXNORM_CACHE: Dict[str, RxNormVerificationResult] = {}


async def query_rxnorm_api(term: str) -> Optional[Dict[str, Any]]:
    """Calls RxNorm approximateTerm REST API."""
    url = f"{settings.RXNORM_API_BASE}/approximateTerm.json"
    params = {"term": term, "maxEntries": 5}
    
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        logger.warning(f"RxNorm API request failed for '{term}': {str(e)}")
    return None


async def verify_medicine_terminology(drug_name: str, strength: Optional[str] = None) -> RxNormVerificationResult:
    """
    Verifies and grounds drug name against official NLM RxNorm database.
    Distinguishes exact matches, ambiguous matches, regional brand concepts, and unmatched items.
    """
    cleaned_name = drug_name.strip()
    clean_lower = cleaned_name.lower()
    
    # Check cache first
    cache_key = f"{clean_lower}|{strength or ''}"
    if cache_key in _RXNORM_CACHE:
        return _RXNORM_CACHE[cache_key]

    # Check for Indian regional brand recognition
    for brand, mapping in INDIAN_BRAND_MAP.items():
        if brand in clean_lower:
            result = RxNormVerificationResult(
                query_term=cleaned_name,
                normalized_name=mapping["generic"],
                rxcui=mapping["rxcui"],
                concept_type="Regional Brand Mapping (India)",
                verification_status="verified_match",
                candidates=[
                    RxNormCandidate(
                        rxcui=mapping["rxcui"],
                        name=mapping["generic"],
                        term_type="Regional Brand -> Generic",
                        score=0.98
                    )
                ],
                is_regional_brand=True,
                regional_brand_note=f"Matched regional trade name '{cleaned_name}' to international active formulation: {mapping['generic']}."
            )
            _RXNORM_CACHE[cache_key] = result
            return result

    # Query Live RxNorm API
    search_term = f"{cleaned_name} {strength}" if strength else cleaned_name
    api_response = await query_rxnorm_api(search_term)
    
    if not api_response:
        # Retry with just the base name if combined term failed
        if strength:
            api_response = await query_rxnorm_api(cleaned_name)

    candidates: List[RxNormCandidate] = []
    
    if api_response:
        approx_group = api_response.get("approximateGroup", {})
        candidate_list = approx_group.get("candidate", [])
        
        for cand in candidate_list:
            rxcui = str(cand.get("rxcui", ""))
            score_str = cand.get("score", "1")
            try:
                score = float(score_str) / 100.0 if float(score_str) > 1.0 else float(score_str)
            except ValueError:
                score = 0.8
            
            # Retrieve name and term type
            cand_name = cand.get("name") or cleaned_name
            # If name is not populated directly in approximateTerm, use term or fetch properties
            candidates.append(RxNormCandidate(
                rxcui=rxcui,
                name=cand_name,
                term_type=cand.get("rxaui", "Concept"),
                score=score
            ))

    if not candidates:
        result = RxNormVerificationResult(
            query_term=cleaned_name,
            normalized_name=None,
            rxcui=None,
            concept_type=None,
            verification_status="no_verified_match",
            candidates=[],
            is_regional_brand=False,
            regional_brand_note="No concept match located in NLM RxNorm. Prescription requires clinician disambiguation."
        )
    elif len(candidates) == 1 or candidates[0].score >= 0.90:
        top = candidates[0]
        result = RxNormVerificationResult(
            query_term=cleaned_name,
            normalized_name=top.name,
            rxcui=top.rxcui,
            concept_type="RxNorm Concept",
            verification_status="verified_match",
            candidates=candidates,
            is_regional_brand=False
        )
    else:
        # Multiple candidates or moderate score -> possible match
        result = RxNormVerificationResult(
            query_term=cleaned_name,
            normalized_name=candidates[0].name,
            rxcui=candidates[0].rxcui,
            concept_type="Possible RxNorm Concept",
            verification_status="possible_match",
            candidates=candidates,
            is_regional_brand=False,
            regional_brand_note="Multiple candidate matches found. Reviewer must verify intended concept."
        )

    _RXNORM_CACHE[cache_key] = result
    return result
