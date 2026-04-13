import logging

from app.config import Config
from app.services.rag.llm.base import BaseLLMProvider

logger = logging.getLogger(__name__)

_PROVIDERS = {
    "gemini": "app.services.rag.llm.gemini.GeminiProvider",
    "openai": "app.services.rag.llm.openai_provider.OpenAIProvider",
    "anthropic": "app.services.rag.llm.anthropic_provider.AnthropicProvider",
}

_cached_provider: BaseLLMProvider | None = None


def get_llm_provider(provider_name: str | None = None) -> BaseLLMProvider:
    global _cached_provider
    name = (provider_name or Config.LLM_PROVIDER).lower()

    if _cached_provider is not None and _cached_provider.__class__.__name__.lower().startswith(name[:4]):
        return _cached_provider

    dotpath = _PROVIDERS.get(name)
    if not dotpath:
        raise ValueError(f"Unknown LLM provider: {name}. Available: {list(_PROVIDERS)}")

    module_path, class_name = dotpath.rsplit(".", 1)
    import importlib
    module = importlib.import_module(module_path)
    cls = getattr(module, class_name)
    provider = cls()

    if not provider.is_available():
        logger.warning(f"Provider {name} has no API key configured, trying fallbacks")
        for fallback_name, fallback_path in _PROVIDERS.items():
            if fallback_name == name:
                continue
            fb_mod_path, fb_cls_name = fallback_path.rsplit(".", 1)
            fb_module = importlib.import_module(fb_mod_path)
            fb_cls = getattr(fb_module, fb_cls_name)
            fb_provider = fb_cls()
            if fb_provider.is_available():
                logger.info(f"Using fallback provider: {fallback_name}")
                _cached_provider = fb_provider
                return fb_provider
        raise RuntimeError("No LLM provider available. Configure at least one API key.")

    _cached_provider = provider
    logger.info(f"Using LLM provider: {name}")
    return provider
