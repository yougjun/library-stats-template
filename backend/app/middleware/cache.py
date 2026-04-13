"""
Prediction Cache — Simple in-memory TTL cache for ML prediction results.
Avoids re-running expensive predictions when the same parameters are requested
within the TTL window (default: 10 minutes).
"""

import time
import logging
from threading import Lock

logger = logging.getLogger(__name__)


class PredictionCache:
    def __init__(self, ttl_seconds: int = 600):
        self._cache = {}
        self._lock = Lock()
        self.ttl = ttl_seconds

    def _make_key(self, floor: str, model_id: int, target_months: list, include_weather: bool) -> str:
        return f"{floor}:{model_id}:{','.join(sorted(target_months))}:{include_weather}"

    def get(self, floor: str, model_id: int, target_months: list, include_weather: bool):
        key = self._make_key(floor, model_id, target_months, include_weather)
        with self._lock:
            if key in self._cache:
                cached_time, data = self._cache[key]
                age = time.time() - cached_time
                if age < self.ttl:
                    logger.info(f"[PredictionCache] HIT: {key} (age: {age:.1f}s)")
                    return data
                logger.info(f"[PredictionCache] EXPIRED: {key} (age: {age:.1f}s)")
                del self._cache[key]
        logger.info(f"[PredictionCache] MISS: {key}")
        return None

    def set(self, floor: str, model_id: int, target_months: list, include_weather: bool, data):
        key = self._make_key(floor, model_id, target_months, include_weather)
        with self._lock:
            self._cache[key] = (time.time(), data)
            logger.info(f"[PredictionCache] SET: {key}")

    def clear(self):
        with self._lock:
            self._cache.clear()


prediction_cache = PredictionCache(ttl_seconds=600)
