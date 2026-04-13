import logging
from typing import List

from chromadb.api.types import EmbeddingFunction, Documents, Embeddings

logger = logging.getLogger(__name__)


def _get_shared_model():
    from app.services.chat.nlu import _get_model
    return _get_model()


class KoSRoBERTaEmbedding(EmbeddingFunction[Documents]):
    def __call__(self, input: Documents) -> Embeddings:
        model = _get_shared_model()
        if model is None:
            raise RuntimeError("Embedding model not available")
        vectors = model.encode(input, normalize_embeddings=True)
        return vectors.tolist()


_embedding_fn: KoSRoBERTaEmbedding | None = None


def get_embedding_function() -> KoSRoBERTaEmbedding:
    global _embedding_fn
    if _embedding_fn is None:
        _embedding_fn = KoSRoBERTaEmbedding()
    return _embedding_fn


def embed_text(text: str) -> List[float]:
    model = _get_shared_model()
    if model is None:
        raise RuntimeError("Embedding model not available")
    return model.encode(text, normalize_embeddings=True).tolist()
