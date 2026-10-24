import logging
from typing import Dict, Any, Optional, List
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


class OpenFDALabelResult:
    def __init__(
        self,
        brand_name: str,
        generic_name: str,
        spl_id: str,
        sections: Dict[str, str],
        source_url: str,
        dosage_forms: List[str] = None,
        substance_names: List[str] = None,
        boxed_warning: Optional[str] = None
    ):
        self.brand_name = brand_name
        self.generic_name = generic_name
        self.spl_id = spl_id
        self.sections = sections
        self.source_url = source_url
        self.dosage_forms = dosage_forms or []
        self.substance_names = substance_names or []
        self.boxed_warning = boxed_warning


async def fetch_openfda_label(drug_name: str) -> Optional[OpenFDALabelResult]:
    """
    Retrieves official drug labeling record from the openFDA drug label endpoint.
    Extracts food interactions, drug interactions, boxed warnings, and patient instructions.
    Uses OPENFDA_API_KEY if configured to elevate rate limits to 240 requests/minute.
    """
    clean_name = drug_name.split()[0].replace("Tab.", "").replace("Cap.", "").replace("Syp.", "").strip()
    if not clean_name or len(clean_name) < 2:
        return None

    # Try searching generic name first, then brand name, then substance name
    queries = [
        f'openfda.generic_name:"{clean_name}"',
        f'openfda.substance_name:"{clean_name}"',
        f'openfda.brand_name:"{clean_name}"'
    ]

    for q in queries:
        params: Dict[str, Any] = {"search": q, "limit": 1}
        if settings.OPENFDA_API_KEY:
            params["api_key"] = settings.OPENFDA_API_KEY

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(settings.OPENFDA_API_BASE, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results", [])
                    if results:
                        rec = results[0]
                        openfda_meta = rec.get("openfda", {})
                        brand_names = openfda_meta.get("brand_name", [clean_name])
                        generic_names = openfda_meta.get("generic_name", [clean_name])
                        dosage_forms = openfda_meta.get("dosage_form", [])
                        substance_names = openfda_meta.get("substance_name", [])
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
                        if "warnings_and_cautions" in rec:
                            sections["warnings_and_cautions"] = " ".join(rec["warnings_and_cautions"][:2])
                        elif "warnings" in rec:
                            sections["warnings_and_cautions"] = " ".join(rec["warnings"][:2])
                        if "contraindications" in rec:
                            sections["contraindications"] = " ".join(rec["contraindications"][:2])

                        boxed_warning = " ".join(rec["boxed_warning"][:1]) if "boxed_warning" in rec else None

                        source_url = (
                            f"https://api.fda.gov/drug/label.json?search=openfda.spl_id:{spl_id}"
                            if spl_id else "https://open.fda.gov/apis/drug/label/"
                        )

                        return OpenFDALabelResult(
                            brand_name=brand_names[0] if brand_names else clean_name,
                            generic_name=generic_names[0] if generic_names else clean_name,
                            spl_id=spl_id,
                            sections=sections,
                            source_url=source_url,
                            dosage_forms=dosage_forms,
                            substance_names=substance_names,
                            boxed_warning=boxed_warning
                        )
        except Exception as e:
            logger.warning(f"openFDA query failed for query {q}: {str(e)}")
            continue

    return None
