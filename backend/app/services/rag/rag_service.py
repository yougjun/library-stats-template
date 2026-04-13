import logging
from typing import Optional

from app.services.rag.retriever import Retriever
from app.services.rag.context_builder import build_prompt
from app.services.rag.config import SYSTEM_PROMPT_KO
from app.services.rag.llm import get_llm_provider

logger = logging.getLogger(__name__)

_retriever: Retriever | None = None


def _get_retriever() -> Retriever:
    global _retriever
    if _retriever is None:
        _retriever = Retriever()
    return _retriever


async def rag_answer(
    question: str,
    parsed_context: Optional[dict] = None,
    db_data: Optional[str] = None,
    n_results: int = 5,
) -> Optional[dict]:
    try:
        retriever = _get_retriever()
        chunks = retriever.search(question, n_results=n_results)

        if not chunks:
            logger.info("RAG: No relevant chunks found")
            return None

        best_distance = chunks[0].distance if chunks else 1.0
        if best_distance > 1.5:
            logger.info(f"RAG: Best chunk distance {best_distance:.2f} too high, skipping")
            return None

        prompt = build_prompt(question, chunks, parsed_context, db_data)
        llm = get_llm_provider()
        result = await llm.generate(
            system_prompt=SYSTEM_PROMPT_KO,
            user_prompt=prompt,
            temperature=0.3,
            max_tokens=1024,
        )

        sources = []
        for chunk in chunks:
            source_info = chunk.metadata.get("source", "unknown")
            detail = chunk.metadata.get("stat_type") or chunk.metadata.get("table") or chunk.metadata.get("data_source") or chunk.metadata.get("filename") or ""
            if detail:
                source_info = f"{source_info}/{detail}"
            sources.append(source_info)

        logger.info(f"RAG answer generated via {result.model}, chunks={len(chunks)}, best_dist={best_distance:.3f}")

        return {
            "response": result.content,
            "sources": sources,
            "model": result.model,
            "chunks_used": len(chunks),
        }

    except Exception as e:
        logger.error(f"RAG pipeline failed: {e}", exc_info=True)
        return None
