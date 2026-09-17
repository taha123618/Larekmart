from collections.abc import AsyncGenerator
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache.redis import RedisCache, get_redis_cache
from app.db.session import async_session_factory
from app.services.analytics_service import AnalyticsService
from app.services.interaction_service import InteractionService
from app.services.recommendation_service import RecommendationService


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


def get_cache() -> RedisCache:
    return get_redis_cache()


def get_recommendation_service(
    session: AsyncSession = Depends(get_db),
    cache: RedisCache = Depends(get_cache),
) -> RecommendationService:
    return RecommendationService(session=session, cache=cache)


def get_interaction_service(
    session: AsyncSession = Depends(get_db),
    cache: RedisCache = Depends(get_cache),
) -> InteractionService:
    return InteractionService(session=session, cache=cache)


def get_analytics_service(
    session: AsyncSession = Depends(get_db),
) -> AnalyticsService:
    return AnalyticsService(session=session)
