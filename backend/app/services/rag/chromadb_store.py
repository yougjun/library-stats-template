import logging
from typing import List, Optional
from pathlib import Path

import chromadb

from app.services.rag.config import CHROMADB_PERSIST_DIR
from app.services.rag.embeddings import get_embedding_function

logger = logging.getLogger(__name__)

_client: chromadb.ClientAPI | None = None


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        Path(CHROMADB_PERSIST_DIR).mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=CHROMADB_PERSIST_DIR)
        logger.info(f"ChromaDB initialized at {CHROMADB_PERSIST_DIR}")
    return _client


class ChromaDBStore:
    def __init__(self):
        self.client = _get_client()
        self.embedding_fn = get_embedding_function()

    def get_or_create_collection(self, name: str) -> chromadb.Collection:
        return self.client.get_or_create_collection(
            name=name,
            embedding_function=self.embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )

    def add_documents(
        self,
        collection_name: str,
        documents: List[str],
        metadatas: List[dict],
        ids: List[str],
    ) -> int:
        collection = self.get_or_create_collection(collection_name)
        batch_size = 100
        total = 0
        for i in range(0, len(documents), batch_size):
            batch_docs = documents[i : i + batch_size]
            batch_meta = metadatas[i : i + batch_size]
            batch_ids = ids[i : i + batch_size]
            collection.upsert(documents=batch_docs, metadatas=batch_meta, ids=batch_ids)
            total += len(batch_docs)
        logger.info(f"Indexed {total} documents into '{collection_name}'")
        return total

    def query(
        self,
        collection_name: str,
        query_text: str,
        n_results: int = 5,
        where: Optional[dict] = None,
    ) -> dict:
        collection = self.get_or_create_collection(collection_name)
        if collection.count() == 0:
            return {"documents": [[]], "distances": [[]], "metadatas": [[]]}
        params = {"query_texts": [query_text], "n_results": n_results}
        if where:
            params["where"] = where
        return collection.query(**params)

    def delete_by_metadata(self, collection_name: str, where: dict) -> None:
        collection = self.get_or_create_collection(collection_name)
        collection.delete(where=where)
        logger.info(f"Deleted documents from '{collection_name}' where {where}")

    def collection_count(self, collection_name: str) -> int:
        collection = self.get_or_create_collection(collection_name)
        return collection.count()

    def reset_collection(self, collection_name: str) -> None:
        try:
            self.client.delete_collection(collection_name)
            logger.info(f"Reset collection '{collection_name}'")
        except Exception:
            pass
