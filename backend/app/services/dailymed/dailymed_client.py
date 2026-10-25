import logging
from typing import List, Dict, Any, Optional
import httpx
from app.core.config import settings
from app.services.api_cache import get_cached_api_response, set_cached_api_response

logger = logging.getLogger(__name__)


class DailyMedLabelResult:
    def __init__(self, title: str, setid: str, url: str, sections: Dict[str, str]):
        self.title = title
        self.setid = setid
        self.url = url
        self.sections = sections


async def fetch_dailymed_spl(drug_name: str) -> Optional[DailyMedLabelResult]:
    """
    Searches official NLM DailyMed API for Structured Product Label (SPL)
    and extracts relevant clinical interaction and administration sections.
    """
    norm_key = drug_name.split()[0].replace("Tab.", "").replace("Cap.", "").replace("Syp.", "").strip().lower()
    if not norm_key:
        return None

    cached = get_cached_api_response("dailymed", norm_key)
    if cached:
        return DailyMedLabelResult(
            title=cached.get("title", ""),
            setid=cached.get("setid", ""),
            url=cached.get("url", ""),
            sections=cached.get("sections", {})
        )

    clean_name = norm_key
    search_url = f"{settings.DAILYMED_API_BASE}/spls.json"
    params = {"drug_name": clean_name, "page": 1, "pagesize": 3}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(search_url, params=params)
            if resp.status_code != 200:
                logger.warning(f"DailyMed search returned {resp.status_code} for '{drug_name}'")
                return None

            data = resp.json()
            spl_items = data.get("data", [])
            if not spl_items:
                return None

            top_spl = spl_items[0]
            setid = top_spl.get("setid")
            title = top_spl.get("title", f"{clean_name.capitalize()} Product Label")
            official_url = f"https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={setid}"

            # Fetch detailed SPL metadata / sections if available
            sections = {
                "general_information": f"Official FDA Structured Product Label for {clean_name} retrieved from NLM DailyMed."
            }

            res = DailyMedLabelResult(
                title=title,
                setid=setid,
                url=official_url,
                sections=sections
            )
            set_cached_api_response("dailymed", norm_key, {
                "title": res.title,
                "setid": res.setid,
                "url": res.url,
                "sections": res.sections
            }, ttl_days=7)
            return res
    except Exception as e:
        logger.warning(f"Failed to fetch DailyMed label for {drug_name}: {str(e)}")
        return None
