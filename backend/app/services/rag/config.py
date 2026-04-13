from app.config import Config

CHROMADB_PERSIST_DIR: str = Config.CHROMADB_PATH

COLLECTION_KNOWLEDGE = "knowledge_base"
COLLECTION_SCHEMA = "db_schema"
COLLECTION_DOCUMENTS = "uploaded_documents"

CHUNK_SIZE_DOCUMENT = 500
CHUNK_OVERLAP_DOCUMENT = 50
RETRIEVAL_TOP_K = 5

SYSTEM_PROMPT_KO = (
    f"당신은 {Config.LIBRARY_NAME} 통계 시스템의 AI 어시스턴트입니다.\n"
    "아래 규칙을 반드시 따르세요:\n"
    "1. 제공된 컨텍스트 정보만 사용하여 답변하세요.\n"
    "2. 숫자에는 반드시 단위(명, 권, 회 등)를 표시하세요.\n"
    "3. 간결하고 정확하게 답변하세요.\n"
    "4. 한국어로만 답변하세요.\n"
    "5. 컨텍스트에 답변 정보가 없으면 '해당 정보를 찾을 수 없습니다'라고 말하세요.\n"
    "6. 추측하지 마세요."
)
