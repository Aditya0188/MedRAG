import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.db.session import engine, Base, run_sqlite_migrations
import asyncio
from app.services.demo_fixtures import seed_sample_prescriptions
from app.services.retrieval.qdrant_rag import preindex_curated_catalog_background
from app.api.v1 import auth, patients, analyses, medicines, evidence, review, metrics, health, demo

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database tables are created & schema migrations applied
    logger.info("Initializing SQLite database models and running safe migrations...")
    Base.metadata.create_all(bind=engine)
    run_sqlite_migrations(engine)
    
    # Pre-render sample synthetic prescriptions for demo mode
    logger.info("Seeding academic sample demo prescriptions...")
    seed_sample_prescriptions()
    
    # Pre-index common drugs' labels into Qdrant in non-blocking background task
    asyncio.create_task(preindex_curated_catalog_background())
    
    yield
    logger.info("Application shutting down.")


app = FastAPI(
    title=settings.PROJECT_TITLE,
    description="Full-stack AI-powered system for reading handwritten medical prescriptions, RxNorm ontological grounding, official DailyMed/openFDA drug-food interaction retrieval via Qdrant RAG, and clinician verification gateway.",
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# CORS Middleware
origins = settings.CORS_ORIGINS
if isinstance(origins, str):
    origins = [origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "title": settings.PROJECT_TITLE,
        "version": settings.APP_VERSION,
        "docs_url": "/docs",
        "health_url": f"{settings.API_V1_PREFIX}/health"
    }


# Include Routers under API_V1_PREFIX
app.include_router(health.router, prefix=settings.API_V1_PREFIX)
app.include_router(health.router)  # Also expose /health at root
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(patients.router, prefix=settings.API_V1_PREFIX)
app.include_router(analyses.router, prefix=settings.API_V1_PREFIX)
app.include_router(medicines.router, prefix=settings.API_V1_PREFIX)
app.include_router(evidence.router, prefix=settings.API_V1_PREFIX)
app.include_router(review.router, prefix=settings.API_V1_PREFIX)
app.include_router(metrics.router, prefix=settings.API_V1_PREFIX)
app.include_router(demo.router, prefix=settings.API_V1_PREFIX)
