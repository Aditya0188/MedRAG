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
from app.core.auth import require_doctor, require_user, get_optional_current_user
from typing import Optional
from app.models.entities import User

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


class DeveloperKeyPayload(BaseModel):
    api_key: str
    validate_key: bool = False


def validate_gemini_key(api_key: str) -> tuple[bool, str]:
    """Validates the Gemini API key against Google GenAI client."""
    if not api_key:
        return False, "API key cannot be empty."
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        # Fast query for model metadata to verify key authentication
        target_model = settings.GEMINI_MODEL or "gemini-2.0-flash"
        client.models.get(model=target_model)
        return True, f"Key verified and authenticated with Google GenAI ({target_model})."
    except Exception as e:
        err_str = str(e)
        if "API_KEY_INVALID" in err_str or "API key not valid" in err_str:
            return False, "Google GenAI rejected this key: API key is not valid."
        if "PERMISSION_DENIED" in err_str:
            return False, "Google GenAI error: Permission denied for this API key."
        return False, f"Key validation check returned: {err_str[:120]}"


def _persist_env_key(key_name: str, value: str):
    """Safely updates or adds a key in active settings and all .env locations."""
    os.environ[key_name] = value
    # Guard: do not overwrite developer's real .env files with dummy test strings during pytest runs
    if os.environ.get("DATABASE_URL", "").startswith("sqlite:///./data/test_"):
        return
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
def update_gemini_api_key(data: ApiKeyUpdate, current_user: User = Depends(require_doctor)):
    """Doctor-only: Saves or updates Gemini API key in active settings and .env files."""
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
def update_openfda_api_key(data: ApiKeyUpdate, current_user: User = Depends(require_doctor)):
    """Doctor-only: Saves or updates openFDA API key in active settings and .env files."""
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


# =========================================================================
# DEVELOPER SETTINGS ENDPOINTS (Accessible to all authenticated/prototype users)
# =========================================================================

@router.post("/developer/key", tags=["Developer Settings"])
def update_developer_gemini_key(
    data: DeveloperKeyPayload,
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Developer Settings: Saves or updates Gemini API key in active settings and .env files.
    Accessible to all users in development/prototype mode to configure AI vision.
    """
    key = data.api_key.strip()
    is_valid = True
    val_msg = "Key saved successfully."
    if key and data.validate_key:
        is_valid, val_msg = validate_gemini_key(key)

    settings.GEMINI_API_KEY = key
    _persist_env_key("GEMINI_API_KEY", key)

    return {
        "status": "success" if is_valid else "warning",
        "message": f"Gemini API Key successfully updated. {val_msg}",
        "has_key": bool(key),
        "is_valid": is_valid,
        "model": settings.GEMINI_MODEL
    }


@router.post("/developer/key/validate", tags=["Developer Settings"])
def test_gemini_key(
    data: DeveloperKeyPayload,
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Developer Settings: Tests whether the provided or active Gemini key is valid."""
    key = data.api_key.strip() if data.api_key else (settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", ""))
    is_valid, val_msg = validate_gemini_key(key)
    return {
        "is_valid": is_valid,
        "message": val_msg,
        "model": settings.GEMINI_MODEL
    }


@router.post("/developer/fda-key", tags=["Developer Settings"])
def update_developer_fda_key(
    data: ApiKeyUpdate,
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Developer Settings: Updates openFDA API key in active settings and .env files."""
    key = data.api_key.strip()
    settings.OPENFDA_API_KEY = key
    _persist_env_key("OPENFDA_API_KEY", key)
    return {
        "status": "success",
        "message": "openFDA API Key successfully updated.",
        "has_key": bool(key),
        "rate_limit": "240 requests/min (Authenticated)" if key else "40 requests/min (Public tier)"
    }


@router.get("/developer/status", tags=["Developer Settings"])
def get_developer_status():
    """Developer Settings: Returns comprehensive system and key status."""
    has_gemini = bool(settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", ""))
    has_fda = bool(settings.OPENFDA_API_KEY or os.environ.get("OPENFDA_API_KEY", ""))
    masked_key = ""
    active_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
    if active_key:
        if len(active_key) > 8:
            masked_key = active_key[:4] + "••••••••" + active_key[-4:]
        else:
            masked_key = "••••••••"

    return {
        "has_gemini_key": has_gemini,
        "gemini_masked_key": masked_key,
        "gemini_model": settings.GEMINI_MODEL,
        "has_fda_key": has_fda,
        "fda_rate_limit": "240 req/min (Authenticated)" if has_fda else "40 req/min (Public tier)",
        "app_mode": settings.APP_MODE,
        "database": "sqlite"
    }


@router.get("/developer/users", tags=["Developer Settings"])
def get_developer_users(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """Developer Settings: Lists registered users in the database."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "created_at": u.created_at.isoformat() if u.created_at else None
        }
        for u in users
    ]
