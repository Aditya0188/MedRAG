from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import Analysis
from app.services.demo_fixtures import DEMO_SCENARIOS, seed_sample_prescriptions

router = APIRouter()


@router.get("/demo/scenarios", tags=["Demo Mode"])
def list_demo_scenarios():
    """Returns the metadata for the 3 distinct academic demonstration scenarios."""
    seed_sample_prescriptions()
    scenarios = []
    for key, sc in DEMO_SCENARIOS.items():
        scenarios.append({
            "id": sc["id"],
            "title": sc["title"],
            "description": sc["description"],
            "patient_name": sc["patient_name"],
            "prescriber_name": sc["prescriber_name"],
            "prescription_date": sc["prescription_date"],
            "filename": sc["filename"],
            "medicine_count": len(sc["medicines"]),
            "evidence_count": len(sc["evidences"])
        })
    return scenarios


@router.post("/demo/reset", tags=["Demo Mode"])
def reset_demo_data(db: Session = Depends(get_db)):
    """
    Safely resets all demo-tagged records.
    Never deletes live or user-uploaded prescriptions.
    """
    demo_analyses = db.query(Analysis).filter(Analysis.is_demo == True).all()
    count = len(demo_analyses)
    for a in demo_analyses:
        db.delete(a)
    db.commit()

    return {
        "status": "success",
        "message": f"Successfully cleared {count} demo analysis records. Live user data preserved.",
        "records_cleared": count
    }
