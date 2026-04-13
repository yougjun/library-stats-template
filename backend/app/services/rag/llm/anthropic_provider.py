import logging
from typing import Optional

from app.config import Config
from app.services.rag.llm.base import BaseLLMProvider, LLMResponse

logger = logging.getLogger(__name__)


class AnthropicProvider(BaseLLMProvider):
    MODEL = "claude-sonnet-4-5-20250929"

    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or Config.ANTHROPIC_API_KEY
        self._client = None

    def _get_client(self):
        if self._client is None:
            from anthropic import AsyncAnthropic
            self._client = AsyncAnthropic(api_key=self._api_key)
        return self._client

    def is_available(self) -> bool:
        return bool(self._api_key)

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        client = self._get_client()
        response = await client.messages.create(
            model=self.MODEL,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return LLMResponse(
            content=response.content[0].text,
            model=self.MODEL,
            prompt_tokens=response.usage.input_tokens,
            completion_tokens=response.usage.output_tokens,
        )
