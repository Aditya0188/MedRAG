from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from app.db.session import get_db
from app.models.entities import Analysis, Review, ExtractedMedicine
from app.schemas.schemas import DashboardMetricsResponse, AnalysisListItem

router = APIRouter()


@router.get("/metrics/summary", response_model=DashboardMetricsResponse, tags=["Dashboard"])
def get_dashboard_metrics(db: Session = Depends(get_db)):
    """
    Computes real-time dashboard analytics directly from persisted database entities.
    No simulated or fabricated numbers.
    """
    total = db.query(Analysis).count()
    pending_reviews = db.query(Analysis).filter(Analysis.review_status == "pending_review").count()
    approved = db.query(Analysis).filter(Analysis.review_status == "approved").count()
    rejected = db.query(Analysis).filter(Analysis.review_status == "rejected").count()
    failed = db.query(Analysis).filter(Analysis.status == "failed").count()

    # Average processing time
    avg_proc = db.query(func.avg(Analysis.total_processing_duration_sec)).filter(
        Analysis.status == "completed",
        Analysis.total_processing_duration_sec > 0
    ).scalar() or 0.0

    # Average review duration
    avg_review = db.query(func.avg(Review.review_duration_seconds)).filter(
        Review.review_duration_seconds > 0
    ).scalar() or 0.0

    # Recent analyses
    recent_records = db.query(Analysis).order_by(desc(Analysis.created_at)).limit(6).all()
    recent_items = []
    for item in recent_records:
        med_count = db.query(ExtractedMedicine).filter(ExtractedMedicine.analysis_id == item.id).count()
        recent_items.append(
            AnalysisListItem(
                id=item.id,
                original_filename=item.original_filename,
                created_at=item.created_at,
                stage=item.stage,
                status=item.status,
                is_demo=item.is_demo,
                review_status=item.review_status,
                medicine_count=med_count,
                total_processing_duration_sec=item.total_processing_duration_sec
            )
        )

    return DashboardMetricsResponse(
        total_analyses=total,
        pending_doctor_reviews=pending_reviews,
        approved_reports=approved,
        rejected_reports=rejected,
        failed_analyses=failed,
        average_processing_time_sec=round(float(avg_proc), 2),
        average_review_time_sec=round(float(avg_review), 2),
        recent_analyses=recent_items
    )
