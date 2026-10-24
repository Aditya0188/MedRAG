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
        self._seed_curated_catalog()

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

    def _seed_curated_catalog(self):
        """Pre-seeds vector store with the 55+ curated FDA drug-food interaction database."""
        try:
            from app.services.retrieval.curated_fda_catalog import get_curated_evidence_catalog
            catalog = get_curated_evidence_catalog()
            self.upsert_evidence_chunks(catalog)
            logger.info(f"Loaded {len(catalog)} gold-standard FDA evidence passages into Qdrant store.")
        except Exception as e:
            logger.warning(f"Failed to seed curated FDA evidence into Qdrant: {str(e)}")

    def upsert_evidence_chunks(self, chunks: List[Dict[str, Any]]):
        """Indexes evidence passages into Qdrant."""
        if not self.client or not chunks:
            return

        points = []
        for i, chunk in enumerate(chunks):
            passage_text = f"{chunk.get('medicine_name', '')} {chunk.get('food_or_substance', '')} {chunk.get('evidence_excerpt', '')}"
            vector = compute_deterministic_text_vector(passage_text)
            unique_str = f"{chunk.get('medicine_name')}-{chunk.get('food_or_substance')}-{chunk.get('id', i)}"
            point_id = int(hashlib.md5(unique_str.encode()).hexdigest()[:15], 16)

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
        except Exception as e:
            logger.warning(f"Error upserting into Qdrant: {str(e)}")

    def search_evidence(self, drug_name: str, query_text: str = "food interaction timing empty stomach milk alcohol", limit: int = 5) -> List[Dict[str, Any]]:
        """Vector similarity search over official drug evidence passages."""
        clean_name = drug_name.lower().replace("tab.", "").replace("cap.", "").replace("syp.", "").strip()

        matched = []
        # Fallback catalog lookup in memory if Qdrant returns nothing or is uninitialized
        from app.services.retrieval.curated_fda_catalog import get_curated_evidence_catalog
        all_catalog = get_curated_evidence_catalog()

        # 1. First attempt Qdrant vector retrieval if client is available
        if self.client:
            search_query = f"{drug_name} {query_text}"
            query_vector = compute_deterministic_text_vector(search_query)

            try:
                results = self.client.query_points(
                    collection_name=COLLECTION_NAME,
                    query=query_vector,
                    limit=limit * 2
                )

                for hit in results.points:
                    payload = hit.payload
                    med_name = payload.get("medicine_name", "").lower()
                    # Check exact or partial name match
                    if clean_name in med_name or med_name in clean_name or any(part in med_name for part in clean_name.split() if len(part) > 3):
                        matched.append(payload)
                    elif hit.score > 0.85:
                        matched.append(payload)
            except Exception as e:
                logger.warning(f"Qdrant vector query failed: {str(e)}")

        # 2. If vector search yielded empty, do deterministic keyword & active substance matching against curated catalog
        if not matched:
            for item in all_catalog:
                med_name = item.get("medicine_name", "").lower()
                # Check match against clean_name
                if (
                    clean_name in med_name
                    or med_name in clean_name
                    or any(part in med_name for part in clean_name.split() if len(part) > 3)
                ):
                    matched.append(item)

        # De-duplicate results by item id or (medicine_name + food_or_substance)
        seen = set()
        deduped = []
        for m in matched:
            k = f"{m.get('medicine_name')}-{m.get('food_or_substance')}"
            if k not in seen:
                seen.add(k)
                deduped.append(m)
                if len(deduped) >= limit:
                    break

        return deduped


# Global singleton instance
evidence_store = QdrantEvidenceStore()
