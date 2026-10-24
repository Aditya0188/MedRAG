from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
import os


class Settings(BaseSettings):
    APP_NAME: str = "Medical Document Analysis & Retrieval System"
    PROJECT_TITLE: str = "Generative AI-Based Medical Document Analysis and Information Retrieval System"
    APP_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = True
    
    # Mode: "demo" or "live"
    APP_MODE: str = "demo"
    
    # AI Credentials & Model Config
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    EMBEDDING_MODEL: str = "text-embedding-004"
    
    # Database
    DATABASE_URL: str = "sqlite:///./data/meddrag.db"
    
    # Vector Search
    QDRANT_URL: str = ""
    QDRANT_PATH: str = "./data/qdrant"
    
    # File Storage
    UPLOAD_DIR: str = "./data/uploads"
    SAMPLES_DIR: str = "./data/samples"
    MAX_UPLOAD_SIZE_MB: int = 15
    
    # External APIs
    RXNORM_API_BASE: str = "https://rxnav.nlm.nih.gov/REST"
    DAILYMED_API_BASE: str = "https://dailymed.nlm.nih.gov/dailymed/services/v2"
    OPENFDA_API_BASE: str = "https://api.fda.gov/drug/label.json"
    
    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.SAMPLES_DIR, exist_ok=True)
os.makedirs(settings.QDRANT_PATH, exist_ok=True)
os.makedirs("./data", exist_ok=True)
