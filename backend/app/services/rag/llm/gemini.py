import logging
from typing import Optional

import google.generativeai as genai

from app.config import Config
from app.services.rag.llm.base import BaseLLMProvider, LLMResponse

logger = logging.getLogger(__name__)


class GeminiProvider(BaseLLMProvider):
    MODEL = "gemini-2.0-flash"

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or Config.GEMINI_API_KEY
        if self._api_key:
            genai.configure(api_key=self._api_key)

    def is_available(self) -> bool:
        return bool(self._api_key)

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        model = genai.GenerativeModel(
            model_name=self.MODEL,
            system_instruction=system_prompt,
            generation_config=genai.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )
        response = await model.generate_content_async(user_prompt)
        usage = getattr(response, "usage_metadata", None)
        return LLMResponse(
            content=response.text,
            model=self.MODEL,
            prompt_tokens=getattr(usage, "prompt_token_count", None),
            completion_tokens=getattr(usage, "candidates_token_count", None),
        )
