import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Optional, Dict
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.entities import ApiCache

logger = logging.getLogger(__name__)


def utc_now():
    return datetime.now(timezone.utc)


def normalize_cache_key(service: str, key: str) -> str:
    cleaned = key.strip().lower()
    return f"{service}:{cleaned}"


def get_cached_api_response(service: str, key: str, db: Optional[Session] = None) -> Optional[Dict[str, Any]]:
    """
    Retrieves a cached JSON response for a given service and key.
    Returns None if cache missed or expired.
    """
    full_key = normalize_cache_key(service, key)
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        record = db.query(ApiCache).filter(ApiCache.cache_key == full_key).first()
        if not record:
            return None

        now = utc_now()
        # Ensure record.expires_at has timezone for comparison
        expires_at = record.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at < now:
            # Expired: remove and return None
            db.delete(record)
            db.commit()
            return None

        return record.response_json
    except Exception as e:
        logger.warning(f"Error reading from API cache for {full_key}: {e}")
        return None
    finally:
        if close_db:
            db.close()


def set_cached_api_response(
    service: str,
    key: str,
    response_data: Any,
    ttl_days: int = 7,
    db: Optional[Session] = None
) -> None:
    """
    Persists a JSON response into the SQLite api_cache table with a specified TTL (default 7 days).
    """
    full_key = normalize_cache_key(service, key)
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        now = utc_now()
        expires = now + timedelta(days=ttl_days)

        record = db.query(ApiCache).filter(ApiCache.cache_key == full_key).first()
        if record:
            record.response_json = response_data
            record.created_at = now
            record.expires_at = expires
        else:
            record = ApiCache(
                cache_key=full_key,
                service=service,
                response_json=response_data,
                created_at=now,
                expires_at=expires
            )
            db.add(record)

        db.commit()
    except Exception as e:
        logger.warning(f"Error writing to API cache for {full_key}: {e}")
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        if close_db:
            db.close()
