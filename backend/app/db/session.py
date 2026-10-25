from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Engine configuration
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def run_sqlite_migrations(target_engine):
    """
    Additive SQLite migration to add nullable columns to existing tables
    without dropping or modifying existing data.
    """
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    with target_engine.connect() as conn:
        # Check analyses table
        try:
            res = conn.exec_driver_sql("PRAGMA table_info(analyses)").fetchall()
            cols = [r[1] for r in res]
            if cols:
                if "patient_id" not in cols:
                    conn.exec_driver_sql("ALTER TABLE analyses ADD COLUMN patient_id VARCHAR(36)")
                if "reviewed_by" not in cols:
                    conn.exec_driver_sql("ALTER TABLE analyses ADD COLUMN reviewed_by VARCHAR(36)")
                if "rejection_reason" not in cols:
                    conn.exec_driver_sql("ALTER TABLE analyses ADD COLUMN rejection_reason TEXT")
                if "reviewed_at" not in cols:
                    conn.exec_driver_sql("ALTER TABLE analyses ADD COLUMN reviewed_at DATETIME")
        except Exception:
            pass

        # Check extracted_medicines table
        try:
            res_med = conn.exec_driver_sql("PRAGMA table_info(extracted_medicines)").fetchall()
            cols_med = [r[1] for r in res_med]
            if cols_med and "bounding_box" not in cols_med:
                conn.exec_driver_sql("ALTER TABLE extracted_medicines ADD COLUMN bounding_box JSON")
        except Exception:
            pass

        # Check audit_events table
        try:
            res_audit = conn.exec_driver_sql("PRAGMA table_info(audit_events)").fetchall()
            cols_audit = [r[1] for r in res_audit]
            if cols_audit and "user_id" not in cols_audit:
                conn.exec_driver_sql("ALTER TABLE audit_events ADD COLUMN user_id VARCHAR(36)")
        except Exception:
            pass

        # Ensure api_cache table exists
        try:
            conn.exec_driver_sql("""
                CREATE TABLE IF NOT EXISTS api_cache (
                    id VARCHAR(36) PRIMARY KEY,
                    cache_key VARCHAR(255) UNIQUE NOT NULL,
                    service VARCHAR(50) NOT NULL,
                    response_json JSON NOT NULL,
                    created_at DATETIME NOT NULL,
                    expires_at DATETIME NOT NULL
                )
            """)
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_api_cache_cache_key ON api_cache (cache_key)")
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_api_cache_service ON api_cache (service)")
        except Exception:
            pass

        conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
