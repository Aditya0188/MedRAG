import hashlib
import logging
import math
import os
import re
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from app.core.config import settings

logger = logging.getLogger(__name__)

COLLECTION_NAME = "drug_evidence_passages"
VECTOR_DIMENSION = 128  # Compact normalized semantic vector for embedded local search


def compute_deterministic_text_vector(text: str, dim: int = VECTOR_DIMENSION) -> List[float]:
    """
    Generates a normalized semantic feature vector for local vector search
    without requiring heavy external torch/transformers models, while fully compatible
    with Qdrant vector indexing and cosine distance.
    """
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", text.lower())
    words = cleaned.split()
    vector = [0.0] * dim
    
    if not words:
        return [1.0 / math.sqrt(dim)] * dim

    for i, word in enumerate(words):
        h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        # Add term frequency with position weighting
        weight = 1.0 + (1.0 / (1.0 + math.log(i + 1)))
        vector[idx] += weight

    # L2 Normalization for cosine metric
    norm = math.sqrt(sum(x * x for x in vector))
    if norm > 0:
        vector = [x / norm for x in vector]
    else:
        vector = [1.0 / math.sqrt(dim)] * dim
    return vector


class QdrantEvidenceStore:
    def __init__(self):
        self.client: Optional[QdrantClient] = None
        self._initialize_client()

    def _initialize_client(self):
        try:
            if settings.QDRANT_URL:
                self.client = QdrantClient(url=settings.QDRANT_URL)
            else:
                # Embedded local path or memory
                os.makedirs(settings.QDRANT_PATH, exist_ok=True)
                try:
                    self.client = QdrantClient(path=settings.QDRANT_PATH)
                except Exception as disk_err:
                    logger.warning(f"Failed to lock local Qdrant path ({disk_err}), falling back to in-memory Qdrant.")
                    self.client = QdrantClient(":memory:")

            # Ensure collection exists
            collections = self.client.get_collections().collections
            exists = any(c.name == COLLECTION_NAME for c in collections)
            if not exists:
                self.client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=qmodels.VectorParams(
                        size=VECTOR_DIMENSION,
                        distance=qmodels.Distance.COSINE
                    )
                )
                logger.info(f"Initialized Qdrant collection '{COLLECTION_NAME}' with dim={VECTOR_DIMENSION}")
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant client: {str(e)}")
            self.client = None

    def upsert_evidence_chunks(self, chunks: List[Dict[str, Any]]):
        """Indexes evidence passages into Qdrant."""
        if not self.client or not chunks:
            return

        points = []
        for i, chunk in enumerate(chunks):
            passage_text = f"{chunk.get('medicine_name', '')} {chunk.get('food_or_substance', '')} {chunk.get('evidence_excerpt', '')}"
            vector = compute_deterministic_text_vector(passage_text)
            point_id = int(hashlib.md5(f"{chunk.get('medicine_name')}-{chunk.get('food_or_substance')}-{i}".encode()).hexdigest()[:15], 16)
            
            points.append(
                qmodels.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=chunk
                )
            )

        try:
            self.client.upsert(
                collection_name=COLLECTION_NAME,
                points=points
            )
            logger.info(f"Successfully indexed {len(points)} evidence passages into Qdrant.")
        except Exception as e:
            logger.warning(f"Error upserting into Qdrant: {str(e)}")

    def search_evidence(self, drug_name: str, query_text: str = "food interaction timing empty stomach milk alcohol", limit: int = 5) -> List[Dict[str, Any]]:
        """Vector similarity search over official drug evidence passages."""
        if not self.client:
            return []

        search_query = f"{drug_name} {query_text}"
        query_vector = compute_deterministic_text_vector(search_query)

        try:
            # Query Qdrant with filter for matching medicine or top semantic candidates
            results = self.client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                limit=limit
            )
            
            matched = []
            for hit in results.points:
                payload = hit.payload
                # Check medicine match or high relevance
                med_name = payload.get("medicine_name", "").lower()
                if drug_name.lower() in med_name or med_name in drug_name.lower():
                    matched.append(payload)
                elif hit.score > 0.70:
                    matched.append(payload)
            return matched
        except Exception as e:
            logger.warning(f"Qdrant vector query failed: {str(e)}")
            return []


# Global singleton instance
evidence_store = QdrantEvidenceStore()
