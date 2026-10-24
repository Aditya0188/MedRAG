import logging
from typing import Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


class OpenFDALabelResult:
    def __init__(self, brand_name: str, generic_name: str, spl_id: str, sections: Dict[str, str], source_url: str):
        self.brand_name = brand_name
        self.generic_name = generic_name
        self.spl_id = spl_id
        self.sections = sections
        self.source_url = source_url


async def fetch_openfda_label(drug_name: str) -> Optional[OpenFDALabelResult]:
    """
    Retrieves official drug labeling record from openFDA drug label endpoint.
    Extracts food interactions, drug interactions, and patient instructions.
    """
    clean_name = drug_name.split()[0].strip()
    
    # Try searching generic name first, then brand name
    queries = [
        f'openfda.generic_name:"{clean_name}"',
        f'openfda.brand_name:"{clean_name}"',
        f'openfda.substance_name:"{clean_name}"'
    ]

    for q in queries:
        params = {"search": q, "limit": 1}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(settings.OPENFDA_API_BASE, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results", [])
                    if results:
                        rec = results[0]
                        openfda_meta = rec.get("openfda", {})
                        brand_names = openfda_meta.get("brand_name", [clean_name])
                        generic_names = openfda_meta.get("generic_name", [clean_name])
                        spl_ids = openfda_meta.get("spl_id", [""])
                        spl_id = spl_ids[0] if spl_ids else ""
                        
                        sections = {}
                        if "food_safety_warning" in rec:
                            sections["food_safety_warning"] = " ".join(rec["food_safety_warning"])
                        if "drug_interactions" in rec:
                            sections["drug_interactions"] = " ".join(rec["drug_interactions"][:3])
                        if "dosage_and_administration" in rec:
                            sections["dosage_and_administration"] = " ".join(rec["dosage_and_administration"][:2])
                        if "information_for_patients" in rec:
                            sections["information_for_patients"] = " ".join(rec["information_for_patients"][:2])
                        if "warnings" in rec:
                            sections["warnings"] = " ".join(rec["warnings"][:2])

                        source_url = f"https://api.fda.gov/drug/label.json?search=openfda.spl_id:{spl_id}" if spl_id else "https://open.fda.gov/apis/drug/label/"

                        return OpenFDALabelResult(
                            brand_name=brand_names[0] if brand_names else clean_name,
                            generic_name=generic_names[0] if generic_names else clean_name,
                            spl_id=spl_id,
                            sections=sections,
                            source_url=source_url
                        )
        except Exception as e:
            logger.warning(f"openFDA query failed for query {q}: {str(e)}")
            continue

    return None
