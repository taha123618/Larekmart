import asyncio
from typing import Any

from app.cache.redis import get_redis_cache
from app.core.logging import get_logger
from app.db.session import async_session_factory
from app.repositories.interaction_repository import InteractionRepository
from app.services.recommendation_service import RecommendationService
from app.workers.celery import celery_app

logger = get_logger("celery_recommendation_tasks")


@celery_app.task(name="app.workers.recommendation_tasks.calculate_trending_products", bind=True, max_retries=3)
def calculate_trending_products(self: Any) -> dict[str, Any]:
    """Precomputes trending products and warms the Redis cache."""
    async def _run() -> dict[str, Any]:
        logger.info("start_calculate_trending_products")
        async with async_session_factory() as session:
            repo = InteractionRepository(session)
            items = await repo.get_trending_products(limit=50, window_hours=48)
            cache = get_redis_cache()
            payload = [{"productId": pid, "score": score} for pid, score in items]
            await cache.set("recommendations:global:trending", payload, ttl=1800)
            logger.info("trending_products_calculated", count=len(items))
            return {"status": "success", "count": len(items)}

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error("calculate_trending_products_failed", error=str(exc))
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.workers.recommendation_tasks.calculate_popular_products", bind=True, max_retries=3)
def calculate_popular_products(self: Any) -> dict[str, Any]:
    """Precomputes popular products and warms the Redis cache."""
    async def _run() -> dict[str, Any]:
        logger.info("start_calculate_popular_products")
        async with async_session_factory() as session:
            repo = InteractionRepository(session)
            items = await repo.get_popular_products(limit=50)
            cache = get_redis_cache()
            payload = [{"productId": pid, "score": score} for pid, score in items]
            await cache.set("recommendations:global:popular", payload, ttl=3600)
            logger.info("popular_products_calculated", count=len(items))
            return {"status": "success", "count": len(items)}

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error("calculate_popular_products_failed", error=str(exc))
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="app.workers.recommendation_tasks.refresh_user_recommendations", bind=True, max_retries=3)
def refresh_user_recommendations(self: Any, user_id: str) -> dict[str, Any]:
    """Warms personalized recommendations for a specific active user."""
    async def _run() -> dict[str, Any]:
        async with async_session_factory() as session:
            cache = get_redis_cache()
            service = RecommendationService(session=session, cache=cache)
            recs = await service.get_personalized_recommendations(user_id=user_id, limit=20)
            return {"status": "success", "user_id": user_id, "count": len(recs.items)}

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error("refresh_user_recommendations_failed", user_id=user_id, error=str(exc))
        raise self.retry(exc=exc, countdown=60)
