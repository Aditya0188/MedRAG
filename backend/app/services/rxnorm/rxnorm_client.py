import logging
import re
from typing import Dict, Any, List, Optional
import httpx
from pydantic import BaseModel
from app.core.config import settings
from app.services.api_cache import get_cached_api_response, set_cached_api_response

logger = logging.getLogger(__name__)


class RxNormCandidate(BaseModel):
    rxcui: str
    name: str
    term_type: Optional[str] = None  # IN (Ingredient), BN (Brand Name), SCD (Semantic Clinical Drug), SBD (Semantic Branded Drug)
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


# Comprehensive Regional Brand Formulary to Active Generic INNs
# Covers 75+ highest volume outpatient prescriptions across India & South Asia
INDIAN_BRAND_MAP: Dict[str, Dict[str, str]] = {
    # Antipyretics / Analgesics / NSAIDs
    "dolo 650": {"generic": "Acetaminophen (Paracetamol) 650 MG Oral Tablet", "ingredient": "Paracetamol / Acetaminophen", "rxcui": "161"},
    "dolo": {"generic": "Acetaminophen (Paracetamol) 500 MG Oral Tablet", "ingredient": "Paracetamol / Acetaminophen", "rxcui": "161"},
    "calpol 650": {"generic": "Acetaminophen (Paracetamol) 650 MG Oral Tablet", "ingredient": "Paracetamol / Acetaminophen", "rxcui": "161"},
    "calpol": {"generic": "Acetaminophen (Paracetamol) 500 MG Oral Tablet", "ingredient": "Paracetamol / Acetaminophen", "rxcui": "161"},
    "crocin": {"generic": "Acetaminophen (Paracetamol) 500 MG Oral Tablet", "ingredient": "Paracetamol / Acetaminophen", "rxcui": "161"},
    "crocin advance": {"generic": "Acetaminophen 500 MG Oral Tablet", "ingredient": "Acetaminophen", "rxcui": "161"},
    "pacimol": {"generic": "Acetaminophen (Paracetamol) 500 MG Oral Tablet", "ingredient": "Paracetamol / Acetaminophen", "rxcui": "161"},
    "combiflam": {"generic": "Ibuprofen 400 MG / Acetaminophen 325 MG Oral Tablet", "ingredient": "Ibuprofen and Acetaminophen", "rxcui": "5640"},
    "meftal spas": {"generic": "Dicyclomine hydrochloride 10 MG / Mefenamic acid 250 MG Oral Tablet", "ingredient": "Dicyclomine and Mefenamic Acid", "rxcui": "3348"},
    "meftal": {"generic": "Mefenamic acid 500 MG Oral Tablet", "ingredient": "Mefenamic Acid", "rxcui": "6719"},
    "voveran": {"generic": "Diclofenac sodium 50 MG Oral Tablet", "ingredient": "Diclofenac", "rxcui": "3355"},
    "voveran sr": {"generic": "Diclofenac sodium 100 MG Extended Release Oral Tablet", "ingredient": "Diclofenac", "rxcui": "3355"},
    "zerodol": {"generic": "Aceclofenac 100 MG Oral Tablet", "ingredient": "Aceclofenac", "rxcui": "35827"},
    "zerodol p": {"generic": "Aceclofenac 100 MG / Acetaminophen 325 MG Oral Tablet", "ingredient": "Aceclofenac and Acetaminophen", "rxcui": "35827"},
    "zerodol sp": {"generic": "Aceclofenac 100 MG / Acetaminophen 325 MG / Serratiopeptidase 15 MG Oral Tablet", "ingredient": "Aceclofenac and Acetaminophen", "rxcui": "35827"},
    "brufen": {"generic": "Ibuprofen 400 MG Oral Tablet", "ingredient": "Ibuprofen", "rxcui": "5640"},
    "ketorol": {"generic": "Ketorolac tromethamine 10 MG Oral Tablet", "ingredient": "Ketorolac", "rxcui": "6142"},
    "ultracet": {"generic": "Tramadol hydrochloride 37.5 MG / Acetaminophen 325 MG Oral Tablet", "ingredient": "Tramadol and Acetaminophen", "rxcui": "10689"},

    # Antibiotics & Anti-Infectives
    "augmentin": {"generic": "Amoxicillin 500 MG / Clavulanate Potassium 125 MG Oral Tablet", "ingredient": "Amoxicillin and Clavulanate Potassium", "rxcui": "617314"},
    "augmentin 625": {"generic": "Amoxicillin 500 MG / Clavulanate Potassium 125 MG Oral Tablet", "ingredient": "Amoxicillin and Clavulanate Potassium", "rxcui": "617314"},
    "amoxyclav": {"generic": "Amoxicillin 500 MG / Clavulanate Potassium 125 MG Oral Tablet", "ingredient": "Amoxicillin and Clavulanate Potassium", "rxcui": "617314"},
    "clavam 625": {"generic": "Amoxicillin 500 MG / Clavulanate Potassium 125 MG Oral Tablet", "ingredient": "Amoxicillin and Clavulanate Potassium", "rxcui": "617314"},
    "azithral 500": {"generic": "Azithromycin 500 MG Oral Tablet", "ingredient": "Azithromycin", "rxcui": "248656"},
    "azithral": {"generic": "Azithromycin 500 MG Oral Tablet", "ingredient": "Azithromycin", "rxcui": "18631"},
    "azee": {"generic": "Azithromycin 500 MG Oral Tablet", "ingredient": "Azithromycin", "rxcui": "18631"},
    "cifran": {"generic": "Ciprofloxacin 500 MG Oral Tablet", "ingredient": "Ciprofloxacin", "rxcui": "309309"},
    "ciplox": {"generic": "Ciprofloxacin 500 MG Oral Tablet", "ingredient": "Ciprofloxacin", "rxcui": "309309"},
    "zifi 200": {"generic": "Cefixime 200 MG Oral Tablet", "ingredient": "Cefixime", "rxcui": "2059"},
    "taxim o": {"generic": "Cefixime 200 MG Oral Tablet", "ingredient": "Cefixime", "rxcui": "2059"},
    "mahacef": {"generic": "Cefixime 200 MG Oral Tablet", "ingredient": "Cefixime", "rxcui": "2059"},
    "oflox": {"generic": "Ofloxacin 200 MG Oral Tablet", "ingredient": "Ofloxacin", "rxcui": "7512"},
    "zenflox": {"generic": "Ofloxacin 200 MG Oral Tablet", "ingredient": "Ofloxacin", "rxcui": "7512"},
    "moxikind": {"generic": "Amoxicillin 500 MG Oral Capsule", "ingredient": "Amoxicillin", "rxcui": "213169"},
    "levoflox": {"generic": "Levofloxacin 500 MG Oral Tablet", "ingredient": "Levofloxacin", "rxcui": "82122"},
    "doxy 100": {"generic": "Doxycycline hyclate 100 MG Oral Capsule", "ingredient": "Doxycycline", "rxcui": "18631"},
    "doxycycline": {"generic": "Doxycycline hyclate 100 MG Oral Capsule", "ingredient": "Doxycycline", "rxcui": "3640"},
    "metrogyl 400": {"generic": "Metronidazole 400 MG Oral Tablet", "ingredient": "Metronidazole", "rxcui": "6922"},
    "metrogyl": {"generic": "Metronidazole 400 MG Oral Tablet", "ingredient": "Metronidazole", "rxcui": "6922"},
    "bactrim": {"generic": "Sulfamethoxazole 800 MG / Trimethoprim 160 MG Oral Tablet", "ingredient": "Sulfamethoxazole and Trimethoprim", "rxcui": "105688"},

    # Gastrointestinal / Antacids / Anti-Emetics
    "pantocid 40": {"generic": "Pantoprazole sodium 40 MG Delayed Release Oral Tablet", "ingredient": "Pantoprazole", "rxcui": "284635"},
    "pantocid": {"generic": "Pantoprazole sodium 40 MG Delayed Release Oral Tablet", "ingredient": "Pantoprazole", "rxcui": "40790"},
    "pan 40": {"generic": "Pantoprazole sodium 40 MG Delayed Release Oral Tablet", "ingredient": "Pantoprazole", "rxcui": "284635"},
    "pan d": {"generic": "Pantoprazole sodium 40 MG / Domperidone 30 MG Delayed Release Oral Capsule", "ingredient": "Pantoprazole and Domperidone", "rxcui": "40790"},
    "pantocid d": {"generic": "Pantoprazole sodium 40 MG / Domperidone 30 MG Delayed Release Oral Capsule", "ingredient": "Pantoprazole and Domperidone", "rxcui": "40790"},
    "omez": {"generic": "Omeprazole 20 MG Delayed Release Oral Capsule", "ingredient": "Omeprazole", "rxcui": "7646"},
    "omez d": {"generic": "Omeprazole 20 MG / Domperidone 10 MG Oral Capsule", "ingredient": "Omeprazole and Domperidone", "rxcui": "7646"},
    "razo 20": {"generic": "Rabeprazole sodium 20 MG Delayed Release Oral Tablet", "ingredient": "Rabeprazole", "rxcui": "358263"},
    "rablet": {"generic": "Rabeprazole sodium 20 MG Delayed Release Oral Tablet", "ingredient": "Rabeprazole", "rxcui": "358263"},
    "aciloc 150": {"generic": "Ranitidine 150 MG Oral Tablet", "ingredient": "Ranitidine", "rxcui": "9143"},
    "aciloc": {"generic": "Ranitidine 150 MG Oral Tablet", "ingredient": "Ranitidine", "rxcui": "9143"},
    "ondem 4": {"generic": "Ondansetron 4 MG Oral Tablet", "ingredient": "Ondansetron", "rxcui": "261551"},
    "ondem": {"generic": "Ondansetron 4 MG Oral Tablet", "ingredient": "Ondansetron", "rxcui": "261551"},
    "emeset": {"generic": "Ondansetron 4 MG Oral Tablet", "ingredient": "Ondansetron", "rxcui": "261551"},
    "domstal": {"generic": "Domperidone 10 MG Oral Tablet", "ingredient": "Domperidone", "rxcui": "35829"},
    "cyclopam": {"generic": "Dicyclomine hydrochloride 20 MG / Paracetamol 500 MG Oral Tablet", "ingredient": "Dicyclomine and Acetaminophen", "rxcui": "3348"},

    # Antidiabetic
    "glycomet 500": {"generic": "Metformin hydrochloride 500 MG Oral Tablet", "ingredient": "Metformin", "rxcui": "860975"},
    "glycomet": {"generic": "Metformin hydrochloride 500 MG Oral Tablet", "ingredient": "Metformin", "rxcui": "6809"},
    "glucophage": {"generic": "Metformin hydrochloride 500 MG Oral Tablet", "ingredient": "Metformin", "rxcui": "860975"},
    "janumet": {"generic": "Metformin hydrochloride 500 MG / Sitagliptin 50 MG Oral Tablet", "ingredient": "Metformin and Sitagliptin", "rxcui": "664871"},
    "galvus met": {"generic": "Metformin hydrochloride 500 MG / Vildagliptin 50 MG Oral Tablet", "ingredient": "Metformin and Vildagliptin", "rxcui": "6809"},
    "forxiga": {"generic": "Dapagliflozin 10 MG Oral Tablet", "ingredient": "Dapagliflozin", "rxcui": "1488564"},
    "dapavel": {"generic": "Dapagliflozin 10 MG Oral Tablet", "ingredient": "Dapagliflozin", "rxcui": "1488564"},
    "glimisave": {"generic": "Glimepiride 1 MG Oral Tablet", "ingredient": "Glimepiride", "rxcui": "258494"},
    "amaryl": {"generic": "Glimepiride 1 MG Oral Tablet", "ingredient": "Glimepiride", "rxcui": "258494"},

    # Cardiovascular & Antihypertensives
    "atorva 10": {"generic": "Atorvastatin 10 MG Oral Tablet", "ingredient": "Atorvastatin", "rxcui": "259255"},
    "atorva 20": {"generic": "Atorvastatin 20 MG Oral Tablet", "ingredient": "Atorvastatin", "rxcui": "83367"},
    "atorva": {"generic": "Atorvastatin 10 MG Oral Tablet", "ingredient": "Atorvastatin", "rxcui": "83367"},
    "lipitor": {"generic": "Atorvastatin 20 MG Oral Tablet", "ingredient": "Atorvastatin", "rxcui": "83367"},
    "rosuvas": {"generic": "Rosuvastatin 10 MG Oral Tablet", "ingredient": "Rosuvastatin", "rxcui": "301542"},
    "telma 40": {"generic": "Telmisartan 40 MG Oral Tablet", "ingredient": "Telmisartan", "rxcui": "316764"},
    "telma": {"generic": "Telmisartan 40 MG Oral Tablet", "ingredient": "Telmisartan", "rxcui": "316764"},
    "telma h": {"generic": "Hydrochlorothiazide 12.5 MG / Telmisartan 40 MG Oral Tablet", "ingredient": "Telmisartan and Hydrochlorothiazide", "rxcui": "316766"},
    "amlong 5": {"generic": "Amlodipine 5 MG Oral Tablet", "ingredient": "Amlodipine", "rxcui": "197361"},
    "amlong": {"generic": "Amlodipine 5 MG Oral Tablet", "ingredient": "Amlodipine", "rxcui": "197361"},
    "envas": {"generic": "Enalapril maleate 5 MG Oral Tablet", "ingredient": "Enalapril", "rxcui": "197655"},
    "cardace": {"generic": "Ramipril 2.5 MG Oral Capsule", "ingredient": "Ramipril", "rxcui": "35296"},
    "concor 5": {"generic": "Bisoprolol fumarate 5 MG Oral Tablet", "ingredient": "Bisoprolol", "rxcui": "197449"},
    "ecosprin 75": {"generic": "Aspirin 75 MG Oral Tablet", "ingredient": "Aspirin", "rxcui": "1191"},
    "ecosprin": {"generic": "Aspirin 75 MG Oral Tablet", "ingredient": "Aspirin", "rxcui": "1191"},

    # Respiratory & Anti-Allergic
    "montair lc": {"generic": "Levocetirizine dihydrochloride 5 MG / Montelukast sodium 10 MG Oral Tablet", "ingredient": "Levocetirizine and Montelukast", "rxcui": "669528"},
    "telekast l": {"generic": "Levocetirizine dihydrochloride 5 MG / Montelukast sodium 10 MG Oral Tablet", "ingredient": "Levocetirizine and Montelukast", "rxcui": "669528"},
    "montek lc": {"generic": "Levocetirizine dihydrochloride 5 MG / Montelukast sodium 10 MG Oral Tablet", "ingredient": "Levocetirizine and Montelukast", "rxcui": "669528"},
    "allegra 120": {"generic": "Fexofenadine hydrochloride 120 MG Oral Tablet", "ingredient": "Fexofenadine", "rxcui": "217117"},
    "allegra": {"generic": "Fexofenadine hydrochloride 120 MG Oral Tablet", "ingredient": "Fexofenadine", "rxcui": "217117"},
    "cetcip": {"generic": "Cetirizine hydrochloride 10 MG Oral Tablet", "ingredient": "Cetirizine", "rxcui": "315677"},
    "cetzine": {"generic": "Cetirizine hydrochloride 10 MG Oral Tablet", "ingredient": "Cetirizine", "rxcui": "315677"},
    "levocet": {"generic": "Levocetirizine dihydrochloride 5 MG Oral Tablet", "ingredient": "Levocetirizine", "rxcui": "669528"},
    "ascoril": {"generic": "Ambroxol / Guaifenesin / Terbutaline Oral Liquid", "ingredient": "Guaifenesin", "rxcui": "5032"},
    "ascoril d": {"generic": "Dextromethorphan / Chlorpheniramine / Phenylephrine Oral Liquid", "ingredient": "Dextromethorphan", "rxcui": "3289"},
    "asthalin": {"generic": "Albuterol 2 MG Oral Tablet", "ingredient": "Albuterol", "rxcui": "435"},

    # Thyroid & Endocrine
    "thyronorm 50": {"generic": "Levothyroxine sodium 0.05 MG Oral Tablet", "ingredient": "Levothyroxine", "rxcui": "10582"},
    "thyronorm": {"generic": "Levothyroxine sodium 0.05 MG Oral Tablet", "ingredient": "Levothyroxine", "rxcui": "10582"},
    "eltroxin": {"generic": "Levothyroxine sodium 0.05 MG Oral Tablet", "ingredient": "Levothyroxine", "rxcui": "10582"},

    # Neuro / Psychiatric
    "nexito 10": {"generic": "Escitalopram 10 MG Oral Tablet", "ingredient": "Escitalopram", "rxcui": "352741"},
    "nexito": {"generic": "Escitalopram 10 MG Oral Tablet", "ingredient": "Escitalopram", "rxcui": "352741"},
    "clonafit": {"generic": "Clonazepam 0.5 MG Oral Tablet", "ingredient": "Clonazepam", "rxcui": "2598"},
    "zapiz": {"generic": "Clonazepam 0.5 MG Oral Tablet", "ingredient": "Clonazepam", "rxcui": "2598"},
    "gabaneuron": {"generic": "Gabapentin 300 MG / Methylcobalamin 500 MCG Oral Capsule", "ingredient": "Gabapentin", "rxcui": "25480"},
    "vertin 16": {"generic": "Betahistine dihydrochloride 16 MG Oral Tablet", "ingredient": "Betahistine", "rxcui": "1427"},
    "vertin": {"generic": "Betahistine dihydrochloride 16 MG Oral Tablet", "ingredient": "Betahistine", "rxcui": "1427"}
}

# Cache for RxNorm API calls to minimize external network requests
_RXNORM_CACHE: Dict[str, RxNormVerificationResult] = {}


def clean_prescription_drug_name(raw_name: str) -> str:
    """Strips prescription dosage form prefixes and artifacts to isolate the drug substance."""
    cleaned = raw_name.strip()
    # Remove prefixes like Tab., Cap., Syp., Inj., Oint.
    cleaned = re.sub(r"^(Tab\.|Tab|Cap\.|Cap|Syp\.|Syp|Inj\.|Inj|Oint\.|Susp\.|Susp|Drp\.|Drops)\s+", "", cleaned, flags=re.IGNORECASE)
    # Remove Latin timing abbreviations e.g. OD, BD, TDS, HS, QID, SOS, stat
    cleaned = re.sub(r"\b(OD|BD|TDS|TID|QID|QDS|HS|SOS|STAT|PC|AC|PO)\b", "", cleaned, flags=re.IGNORECASE)
    # Remove dosage trailing markers like 'x 5d', 'x 3 days'
    cleaned = re.sub(r"x\s*\d+\s*(d|days|w|weeks)", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


async def fetch_rxcui_concept_name(rxcui: str) -> Optional[str]:
    """Retrieves official concept properties from NLM RxNorm for a given RxCUI."""
    url = f"{settings.RXNORM_API_BASE}/rxcui/{rxcui}/properties.json"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                props = data.get("properties", {})
                return props.get("name")
    except Exception as e:
        logger.debug(f"Failed to fetch RxCUI {rxcui} properties: {e}")
    return None


async def query_rxnorm_api(term: str) -> Optional[Dict[str, Any]]:
    """Calls RxNorm approximateTerm REST API."""
    url = f"{settings.RXNORM_API_BASE}/approximateTerm.json"
    params = {"term": term, "maxEntries": 5}
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        logger.warning(f"RxNorm API request failed for '{term}': {str(e)}")
    return None


async def verify_medicine_terminology(drug_name: str, strength: Optional[str] = None) -> RxNormVerificationResult:
    """
    Verifies and grounds drug name against official NLM RxNorm database.
    1. First checks comprehensive regional brand dictionary (75+ Indian brands).
    2. Queries live RxNorm approximateTerm API and fetches official clinical concept names.
    """
    raw_cleaned = drug_name.strip()
    clean_drug = clean_prescription_drug_name(raw_cleaned)
    clean_lower = clean_drug.lower()

    if len(clean_drug) < 3 or "?" in raw_cleaned:
        return RxNormVerificationResult(
            query_term=raw_cleaned,
            normalized_name=None,
            rxcui=None,
            concept_type=None,
            verification_status="unclear_handwriting",
            candidates=[],
            is_regional_brand=False,
            regional_brand_note="Ambiguous or unreadable handwriting requiring clinician verification."
        )

    # Check cache first (in-memory then persistent SQLite)
    cache_key = f"{clean_lower}|{strength or ''}"
    if cache_key in _RXNORM_CACHE:
        return _RXNORM_CACHE[cache_key]
    persisted = get_cached_api_response("rxnorm", cache_key)
    if persisted:
        try:
            res = RxNormVerificationResult(**persisted)
            _RXNORM_CACHE[cache_key] = res
            return res
        except Exception:
            pass

    # 1. Match against Regional Indian Brand Formulary
    for brand, mapping in INDIAN_BRAND_MAP.items():
        if brand == clean_lower or clean_lower.startswith(brand + " ") or f" {brand} " in f" {clean_lower} ":
            result = RxNormVerificationResult(
                query_term=raw_cleaned,
                normalized_name=mapping["generic"],
                rxcui=mapping["rxcui"],
                concept_type="Regional Brand Mapping (India)",
                verification_status="verified_match",
                candidates=[
                    RxNormCandidate(
                        rxcui=mapping["rxcui"],
                        name=mapping["generic"],
                        term_type="Regional Brand -> Generic INN",
                        score=0.98
                    )
                ],
                is_regional_brand=True,
                regional_brand_note=f"Matched regional trade brand '{raw_cleaned}' to official international formulation: {mapping['generic']} (Active: {mapping['ingredient']})."
            )
            _RXNORM_CACHE[cache_key] = result
            set_cached_api_response("rxnorm", cache_key, result.model_dump(), ttl_days=7)
            return result

    # 2. Query Live RxNorm API
    search_term = f"{clean_drug} {strength}" if strength else clean_drug
    api_response = await query_rxnorm_api(search_term)

    if not api_response and strength:
        # Retry with base molecule name if strength was attached
        api_response = await query_rxnorm_api(clean_drug)

    candidates: List[RxNormCandidate] = []

    if api_response:
        approx_group = api_response.get("approximateGroup", {})
        candidate_list = approx_group.get("candidate", [])

        for i, cand in enumerate(candidate_list[:4]):
            rxcui = str(cand.get("rxcui", "")).strip()
            if not rxcui:
                continue

            score_str = cand.get("score", "1")
            try:
                score = float(score_str) / 100.0 if float(score_str) > 1.0 else float(score_str)
            except ValueError:
                score = 0.80

            # Retrieve authentic concept name for top candidate
            official_name = (await fetch_rxcui_concept_name(rxcui)) if i == 0 else None
            official_name = official_name or cand.get("name") or clean_drug
            candidates.append(RxNormCandidate(
                rxcui=rxcui,
                name=official_name,
                term_type=cand.get("rxaui", "Concept"),
                score=round(score, 3)
            ))

    if not candidates:
        result = RxNormVerificationResult(
            query_term=raw_cleaned,
            normalized_name=None,
            rxcui=None,
            concept_type=None,
            verification_status="no_verified_match",
            candidates=[],
            is_regional_brand=False,
            regional_brand_note="No concept match located in NLM RxNorm. Prescription requires clinician review and verification."
        )
    elif len(candidates) == 1 or candidates[0].score >= 0.85:
        top = candidates[0]
        result = RxNormVerificationResult(
            query_term=raw_cleaned,
            normalized_name=top.name,
            rxcui=top.rxcui,
            concept_type="RxNorm Clinical Concept",
            verification_status="verified_match",
            candidates=candidates,
            is_regional_brand=False
        )
    else:
        # Multiple candidates or moderate score -> possible match
        result = RxNormVerificationResult(
            query_term=raw_cleaned,
            normalized_name=candidates[0].name,
            rxcui=candidates[0].rxcui,
            concept_type="Possible RxNorm Concept",
            verification_status="possible_match",
            candidates=candidates,
            is_regional_brand=False,
            regional_brand_note="Multiple candidate matches found. Reviewer must verify intended concept."
        )

    _RXNORM_CACHE[cache_key] = result
    set_cached_api_response("rxnorm", cache_key, result.model_dump(), ttl_days=7)
    return result
