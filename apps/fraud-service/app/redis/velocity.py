import time
from typing import Any
import redis.asyncio as aioredis
from app.core.config import get_settings
from app.core.logging import get_logger
from app.observability.metrics import FRAUD_VELOCITY_CHECK_DURATION_SECONDS

logger = get_logger("fraud-service.velocity")

_redis_client: aioredis.Redis | None = None
# In-memory fallback sliding window store for testing or Redis degradation
_in_memory_windows: dict[str, list[float]] = {}


async def get_redis() -> aioredis.Redis | None:
    global _redis_client
    # If client is bound to a closed event loop, reset it
    if _redis_client is not None:
        try:
            import asyncio
            current_loop = asyncio.get_running_loop()
            connection_pool_loop = getattr(_redis_client.connection_pool, "_loop", None)
            if connection_pool_loop is not None and connection_pool_loop != current_loop:
                _redis_client = None
        except Exception:
            _redis_client = None

    if _redis_client is None:
        settings = get_settings()
        try:
            client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2.0,
                socket_timeout=2.0,
            )
            # Test ping
            await client.ping()
            _redis_client = client
        except Exception as e:
            logger.warn("Failed to connect to Redis for velocity tracking; falling back to in-memory", error=str(e))
            _redis_client = None
    return _redis_client


class VelocityTracker:
    """
    Sliding window event counter using Redis Sorted Sets (ZSET).
    Enables sub-millisecond tracking of transaction velocity, IP hopping, and failed card attempts.
    """

    def __init__(self, key_prefix: str = "fraud:velocity:"):
        self.key_prefix = key_prefix

    async def record_event(self, key_identifier: str, timestamp: float | None = None) -> int:
        start_time = time.time()
        now = timestamp or start_time
        full_key = f"{self.key_prefix}{key_identifier}"
        settings = get_settings()
        window = settings.VELOCITY_WINDOW_SECONDS

        client = await get_redis()
        if client:
            try:
                pipe = client.pipeline()
                member = f"{now}:{time.time_ns()}"
                pipe.zadd(full_key, {member: now})
                # Evict elements older than the sliding window
                pipe.zremrangebyscore(full_key, 0, now - window)
                pipe.zcard(full_key)
                pipe.expire(full_key, window * 2)
                results = await pipe.execute()
                count = int(results[2])
                FRAUD_VELOCITY_CHECK_DURATION_SECONDS.observe(time.time() - start_time)
                return count
            except Exception as e:
                logger.warn("Redis error recording velocity; using in-memory store", error=str(e))

        # In-memory fallback
        events = _in_memory_windows.setdefault(full_key, [])
        cutoff = now - window
        # Filter out expired
        _in_memory_windows[full_key] = [t for t in events if t > cutoff] + [now]
        count = len(_in_memory_windows[full_key])
        FRAUD_VELOCITY_CHECK_DURATION_SECONDS.observe(time.time() - start_time)
        return count

    async def get_velocity(self, key_identifier: str, window_seconds: int | None = None) -> int:
        now = time.time()
        settings = get_settings()
        window = window_seconds or settings.VELOCITY_WINDOW_SECONDS
        full_key = f"{self.key_prefix}{key_identifier}"

        client = await get_redis()
        if client:
            try:
                # Count members between (now - window) and +inf
                count = await client.zcount(full_key, now - window, "+inf")
                return int(count)
            except Exception as e:
                logger.warn("Redis error querying velocity; using in-memory store", error=str(e))

        # In-memory fallback
        events = _in_memory_windows.get(full_key, [])
        cutoff = now - window
        valid = [t for t in events if t > cutoff]
        _in_memory_windows[full_key] = valid
        return len(valid)

    async def reset(self) -> None:
        """Resets velocity state."""
        global _in_memory_windows
        _in_memory_windows.clear()
        client = await get_redis()
        if client:
            try:
                keys = await client.keys(f"{self.key_prefix}*")
                if keys:
                    await client.delete(*keys)
            except Exception:
                pass


velocity_tracker = VelocityTracker()
