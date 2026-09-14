import asyncio
from typing import Any

from app.core.logging import get_logger
from app.db.session import async_session_factory
from app.embeddings.provider import ScikitHashingEmbeddingProvider
from app.embeddings.service import EmbeddingService
from app.workers.celery import celery_app

logger = get_logger("celery_embedding_tasks")


@celery_app.task(name="app.workers.embedding_tasks.generate_product_embedding", bind=True, max_retries=3)
def generate_product_embedding(
    self: Any,
    product_id: int,
    name: str,
    description: str = "",
    brand: str = "",
    category: str = "",
    tags: list[str] | None = None,
) -> dict[str, Any]:
    """Generates and stores a product vector embedding in pgvector."""
    async def _run() -> dict[str, Any]:
        async with async_session_factory() as session:
            provider = ScikitHashingEmbeddingProvider(dimensions=128)
            service = EmbeddingService(session=session, provider=provider)
            embedding = await service.index_product(
                product_id=product_id,
                name=name,
                description=description,
                brand=brand,
                category=category,
                tags=tags or [],
            )
            await session.commit()
            logger.info("product_embedding_generated", product_id=product_id)
            return {"status": "success", "product_id": product_id, "embedding_id": embedding.id}

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error("generate_product_embedding_failed", product_id=product_id, error=str(exc))
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="app.workers.embedding_tasks.generate_user_embedding", bind=True, max_retries=3)
def generate_user_embedding(self: Any, user_id: str) -> dict[str, Any]:
    """Computes a user's preference vector aggregated from interacted product vectors."""
    async def _run() -> dict[str, Any]:
        async with async_session_factory() as session:
            provider = ScikitHashingEmbeddingProvider(dimensions=128)
            service = EmbeddingService(session=session, provider=provider)
            embedding = await service.build_user_embedding(user_id=user_id)
            await session.commit()
            if embedding:
                logger.info("user_embedding_generated", user_id=user_id)
                return {"status": "success", "user_id": user_id, "updated": True}
            return {"status": "skipped", "user_id": user_id, "reason": "insufficient_interactions"}

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error("generate_user_embedding_failed", user_id=user_id, error=str(exc))
        raise self.retry(exc=exc, countdown=30)
