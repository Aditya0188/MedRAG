import pytest
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Configure test environment variables before importing app
os.environ["DATABASE_URL"] = "sqlite:///./data/test_meddrag.db"
os.environ["APP_MODE"] = "demo"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.session import Base, get_db, run_sqlite_migrations
from app.models.entities import User, PatientProfile
from app.core.auth import hash_password, create_access_token, COOKIE_NAME

TEST_DB_URL = "sqlite:///./data/test_meddrag.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    run_sqlite_migrations(test_engine)
    
    # Pre-seed test doctor and patients
    db = TestingSessionLocal()
    try:
        pw_hash = hash_password("DemoPassword123!")
        
        # Doctor
        doc = User(
            id="test-doc-001",
            name="Dr. Sarah Chen, MD",
            email="dr.chen@meddrag.hospital",
            password_hash=pw_hash,
            role="doctor"
        )
        db.merge(doc)

        # Patient 1
        p1 = User(
            id="test-pat-001",
            name="John Miller",
            email="john.miller@example.com",
            password_hash=pw_hash,
            role="patient"
        )
        db.merge(p1)
        prof1 = PatientProfile(
            user_id="test-pat-001",
            age=52,
            sex="M",
            allergies=["Penicillin"],
            conditions=["Hypertension"],
            notes="Test patient 1"
        )
        db.merge(prof1)

        # Patient 2
        p2 = User(
            id="test-pat-002",
            name="Priya Patel",
            email="priya.patel@example.com",
            password_hash=pw_hash,
            role="patient"
        )
        db.merge(p2)
        prof2 = PatientProfile(
            user_id="test-pat-002",
            age=34,
            sex="F",
            allergies=["Amoxicillin"],
            conditions=["Asthma"],
            notes="Test patient 2"
        )
        db.merge(prof2)

        db.commit()
    finally:
        db.close()

    yield

    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists("./data/test_meddrag.db"):
        try:
            os.remove("./data/test_meddrag.db")
        except Exception:
            pass


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def unauthenticated_client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def client(db_session):
    """Default client authenticated as Doctor (for backward compatibility of analyses flow tests)."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        token = create_access_token(
            data={"sub": "test-doc-001", "email": "dr.chen@meddrag.hospital", "role": "doctor", "name": "Dr. Sarah Chen, MD"}
        )
        c.cookies.set(COOKIE_NAME, token)
        c.headers["Authorization"] = f"Bearer {token}"
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def doctor_client(client):
    return client


@pytest.fixture
def patient_client(db_session):
    """Client authenticated as Patient 1 (John Miller)."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        token = create_access_token(
            data={"sub": "test-pat-001", "email": "john.miller@example.com", "role": "patient", "name": "John Miller"}
        )
        c.cookies.set(COOKIE_NAME, token)
        c.headers["Authorization"] = f"Bearer {token}"
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def other_patient_client(db_session):
    """Client authenticated as Patient 2 (Priya Patel)."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        token = create_access_token(
            data={"sub": "test-pat-002", "email": "priya.patel@example.com", "role": "patient", "name": "Priya Patel"}
        )
        c.cookies.set(COOKIE_NAME, token)
        c.headers["Authorization"] = f"Bearer {token}"
        yield c
    app.dependency_overrides.clear()
