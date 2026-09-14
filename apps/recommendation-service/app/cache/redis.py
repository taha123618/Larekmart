import json
from typing import Any
import redis.asyncio as aioredis
from app.core.config import get_settings
from app.core.logging import get_logger
from app.observability.metrics import (
    RECOMMENDATION_CACHE_HITS_TOTAL,
    RECOMMENDATION_CACHE_MISSES_TOTAL,
)

logger = get_logger("cache")
_redis_client: aioredis.Redis | None = None
_cache_instance: "RecommendationCache | None" = None


async def get_redis_client() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


async def close_redis() -> None:
    global _redis_client, _cache_instance
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None
        _cache_instance = None


class RecommendationCache:
    def __init__(self, client: aioredis.Redis | None = None) -> None:
        self._client = client

    async def _get_client(self) -> aioredis.Redis:
        if self._client is None:
            self._client = await get_redis_client()
        return self._client

    @staticmethod
    def user_personalized_key(user_id: str) -> str:
        return f"recommendations:user:{user_id}:personalized"

    @staticmethod
    def user_trending_key(user_id: str) -> str:
        return f"recommendations:user:{user_id}:trending"

    @staticmethod
    def product_similar_key(product_id: int) -> str:
        return f"recommendations:product:{product_id}:similar"

    @staticmethod
    def product_fbt_key(product_id: int) -> str:
        return f"recommendations:product:{product_id}:fbt"

    @staticmethod
    def category_popular_key(category_id: str) -> str:
        return f"recommendations:category:{category_id}:popular"

    @staticmethod
    def global_trending_key() -> str:
        return "recommendations:global:trending"

    @staticmethod
    def global_popular_key() -> str:
        return "recommendations:global:popular"

    async def get_json(self, key: str, cache_type: str = "recommendation") -> Any | None:
        try:
            client = await self._get_client()
            data = await client.get(key)
            if data:
                RECOMMENDATION_CACHE_HITS_TOTAL.labels(cache_type=cache_type).inc()
                return json.loads(data)
            RECOMMENDATION_CACHE_MISSES_TOTAL.labels(cache_type=cache_type).inc()
            return None
        except Exception as e:
            logger.warning("cache_read_failed", key=key, error=str(e))
            return None

    async def set_json(self, key: str, value: Any, ttl: int = 300) -> bool:
        try:
            client = await self._get_client()
            serialized = json.dumps(value, default=str)
            await client.set(key, serialized, ex=ttl)
            return True
        except Exception as e:
            logger.warning("cache_write_failed", key=key, error=str(e))
            return False

    async def get(self, key: str) -> Any | None:
        return await self.get_json(key)

    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        return await self.set_json(key, value, ttl=ttl)

    async def delete(self, *keys: str) -> bool:
        try:
            client = await self._get_client()
            if keys:
                await client.delete(*keys)
            return True
        except Exception as e:
            logger.warning("cache_delete_failed", keys=keys, error=str(e))
            return False

    async def ping(self) -> bool:
        try:
            client = await self._get_client()
            res = await client.ping()
            return bool(res)
        except Exception as e:
            logger.warning("redis_ping_failed", error=str(e))
            return False

    async def close(self) -> None:
        if self._client is not None:
            await self._client.close()
            self._client = None

    async def invalidate_user(self, user_id: str) -> None:
        try:
            client = await self._get_client()
            pattern = f"recommendations:user:{user_id}:*"
            keys = [key async for key in client.scan_iter(pattern)]
            if keys:
                await client.delete(*keys)
        except Exception as e:
            logger.warning("cache_user_invalidation_failed", user_id=user_id, error=str(e))

    async def invalidate_product(self, product_id: int) -> None:
        try:
            client = await self._get_client()
            await client.delete(
                self.product_similar_key(product_id),
                self.product_fbt_key(product_id),
            )
        except Exception as e:
            logger.warning("cache_product_invalidation_failed", product_id=product_id, error=str(e))


RedisCache = RecommendationCache


def get_redis_cache() -> RecommendationCache:
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = RecommendationCache()
    return _cache_instance
