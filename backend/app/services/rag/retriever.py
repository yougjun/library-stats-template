import logging
from dataclasses import dataclass
from typing import List, Optional

from app.services.rag.chromadb_store import ChromaDBStore
from app.services.rag.config import (
    COLLECTION_KNOWLEDGE,
    COLLECTION_SCHEMA,
    COLLECTION_DOCUMENTS,
    RETRIEVAL_TOP_K,
)

logger = logging.getLogger(__name__)


@dataclass
class RetrievedChunk:
    content: str
    source: str
    distance: float
    metadata: dict


class Retriever:
    def __init__(self):
        self.store = ChromaDBStore()

    def search(
        self,
        query: str,
        n_results: int = RETRIEVAL_TOP_K,
        collections: Optional[List[str]] = None,
    ) -> List[RetrievedChunk]:
        if collections is None:
            collections = [COLLECTION_KNOWLEDGE, COLLECTION_SCHEMA, COLLECTION_DOCUMENTS]

        all_chunks: List[RetrievedChunk] = []

        for col_name in collections:
            try:
                if self.store.collection_count(col_name) == 0:
                    continue
                results = self.store.query(col_name, query, n_results=n_results)
                docs = results.get("documents", [[]])[0]
                distances = results.get("distances", [[]])[0]
                metadatas = results.get("metadatas", [[]])[0]

                for doc, dist, meta in zip(docs, distances, metadatas):
                    all_chunks.append(RetrievedChunk(
                        content=doc,
                        source=col_name,
                        distance=dist,
                        metadata=meta or {},
                    ))
            except Exception as e:
                logger.warning(f"Failed to query collection '{col_name}': {e}")

        all_chunks.sort(key=lambda c: c.distance)
        return all_chunks[:n_results]
