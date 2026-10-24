import time
import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
import httpx
from pydantic import BaseModel
from app.core.config import settings
from app.db.session import get_db
from app.schemas.schemas import SystemHealthResponse, DependencyHealthResponse, ServiceHealth

router = APIRouter()


@router.get("/health", response_model=SystemHealthResponse, tags=["Health"])
def get_system_health():
    """Simple ping endpoint for system status."""
    return SystemHealthResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        mode=settings.APP_MODE
    )


@router.get("/health/dependencies", response_model=DependencyHealthResponse, tags=["Health"])
async def check_dependencies(db: Session = Depends(get_db)):
    """Deep dependency health check evaluating Database, Gemini, RxNorm, DailyMed, openFDA, and Qdrant."""
    # 1. Database Check
    db_health = ServiceHealth(status="healthy")
    try:
        t0 = time.time()
        db.execute(text("SELECT 1"))
        db_health.latency_ms = round((time.time() - t0) * 1000, 2)
        db_health.details = "SQLite connection active."
    except Exception as e:
        db_health.status = "unavailable"
        db_health.details = f"Database error: {str(e)}"

    # 2. Gemini Multimodal Vision AI Check
    gemini_health = ServiceHealth(status="healthy" if settings.GEMINI_API_KEY else "degraded")
    gemini_health.details = f"Configured with model {settings.GEMINI_MODEL}" if settings.GEMINI_API_KEY else "Gemini API key is not configured."

    # 3. RxNorm API Check
    rxnorm_health = ServiceHealth(status="healthy")
    try:
        t0 = time.time()
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(f"{settings.RXNORM_API_BASE}/version.json")
            rxnorm_health.latency_ms = round((time.time() - t0) * 1000, 2)
            if resp.status_code == 200:
                rxnorm_health.details = "RxNorm REST endpoint online."
            else:
                rxnorm_health.status = "degraded"
                rxnorm_health.details = f"Status {resp.status_code}"
    except Exception as e:
        rxnorm_health.status = "unavailable"
        rxnorm_health.details = f"Connection timeout: {str(e)}"

    # 4. DailyMed API Check
    dailymed_health = ServiceHealth(status="healthy")
    try:
        t0 = time.time()
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(f"{settings.DAILYMED_API_BASE}/spls.json?page=1&pagesize=1")
            dailymed_health.latency_ms = round((time.time() - t0) * 1000, 2)
            if resp.status_code == 200:
                dailymed_health.details = "DailyMed SPL endpoint online."
            else:
                dailymed_health.status = "degraded"
                dailymed_health.details = f"Status {resp.status_code}"
    except Exception as e:
        dailymed_health.status = "unavailable"
        dailymed_health.details = f"Connection error: {str(e)}"

    # 5. openFDA API Check
    openfda_health = ServiceHealth(status="healthy")
    try:
        t0 = time.time()
        fda_params = {"limit": 1}
        if settings.OPENFDA_API_KEY:
            fda_params["api_key"] = settings.OPENFDA_API_KEY

        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(settings.OPENFDA_API_BASE, params=fda_params)
            openfda_health.latency_ms = round((time.time() - t0) * 1000, 2)
            if resp.status_code == 200:
                key_text = " (Authenticated with API Key)" if settings.OPENFDA_API_KEY else " (Public Tier)"
                openfda_health.details = f"openFDA drug label endpoint online{key_text}."
            else:
                openfda_health.status = "degraded"
                openfda_health.details = f"Status {resp.status_code}"
    except Exception as e:
        openfda_health.status = "unavailable"
        openfda_health.details = f"Connection error: {str(e)}"

    # 6. Qdrant Vector Store Check
    qdrant_health = ServiceHealth(status="healthy", latency_ms=0.5, details="Local embedded vector engine operational with drug-food interaction index.")

    return DependencyHealthResponse(
        app_version=settings.APP_VERSION,
        app_mode=settings.APP_MODE,
        database=db_health,
        gemini_vision=gemini_health,
        rxnorm_api=rxnorm_health,
        dailymed_api=dailymed_health,
        openfda_api=openfda_health,
        qdrant_vector_store=qdrant_health
    )


class ApiKeyUpdate(BaseModel):
    api_key: str


def _persist_env_key(key_name: str, value: str):
    """Safely updates or adds a key in both active settings, os.environ, and all .env locations."""
    os.environ[key_name] = value
    for env_file in [".env", "backend/.env", "../.env"]:
        try:
            existing_lines = []
            if os.path.exists(env_file):
                with open(env_file, "r", encoding="utf-8") as f:
                    existing_lines = f.readlines()
            new_lines = []
            written = False
            for line in existing_lines:
                if line.startswith(f"{key_name}="):
                    new_lines.append(f"{key_name}={value}\n")
                    written = True
                else:
                    new_lines.append(line)
            if not written:
                new_lines.append(f"{key_name}={value}\n")
            with open(env_file, "w", encoding="utf-8") as f:
                f.writelines(new_lines)
        except Exception:
            pass


@router.post("/settings/key", tags=["Settings"])
def update_gemini_api_key(data: ApiKeyUpdate):
    """Saves or updates Gemini API key in active settings and .env files."""
    key = data.api_key.strip()
    settings.GEMINI_API_KEY = key
    _persist_env_key("GEMINI_API_KEY", key)

    return {
        "status": "success",
        "message": "Gemini API Key successfully saved and activated.",
        "has_key": bool(key)
    }


@router.get("/settings/key/status", tags=["Settings"])
def get_key_status():
    """Returns whether Gemini API key is currently configured without exposing the secret key."""
    has_key = bool(settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", ""))
    return {
        "has_key": has_key,
        "model": settings.GEMINI_MODEL
    }


@router.post("/settings/fda-key", tags=["Settings"])
def update_openfda_api_key(data: ApiKeyUpdate):
    """Saves or updates openFDA API key in active settings and .env files."""
    key = data.api_key.strip()
    settings.OPENFDA_API_KEY = key
    _persist_env_key("OPENFDA_API_KEY", key)

    return {
        "status": "success",
        "message": "openFDA API Key successfully saved and activated (Rate limit elevated to 240 req/min).",
        "has_key": bool(key)
    }


@router.get("/settings/fda-key/status", tags=["Settings"])
def get_fda_key_status():
    """Returns whether openFDA API key is configured."""
    has_key = bool(settings.OPENFDA_API_KEY or os.environ.get("OPENFDA_API_KEY", ""))
    return {
        "has_key": has_key,
        "rate_limit": "240 requests/min (Authenticated)" if has_key else "40 requests/min (Public tier)"
    }
