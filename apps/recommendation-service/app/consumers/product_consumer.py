from typing import Any
from sqlalchemy import delete

from app.cache.redis import get_redis_cache
from app.core.logging import get_logger
from app.db.models.product_embedding import ProductEmbedding
from app.db.session import async_session_factory
from app.embeddings.provider import ScikitHashingEmbeddingProvider
from app.embeddings.service import EmbeddingService
from app.repositories.event_repository import EventRepository

logger = get_logger("product_consumer")


async def process_product_event(topic: str, payload: dict[str, Any], event_id: str) -> None:
    """Consumes product.created, product.updated, and product.deleted events."""
    product_id_raw = payload.get("id") or payload.get("productId")
    if not product_id_raw:
        logger.warning("product_event_missing_id", topic=topic, payload=payload)
        return

    try:
        product_id = int(product_id_raw)
    except (ValueError, TypeError):
        logger.warning("invalid_product_id_format", product_id=product_id_raw)
        return

    async with async_session_factory() as session:
        event_repo = EventRepository(session)
        if await event_repo.is_processed(event_id):
            logger.info("product_event_already_processed", event_id=event_id)
            return

        cache = get_redis_cache()

        if topic == "product.deleted":
            await session.execute(
                delete(ProductEmbedding).where(ProductEmbedding.product_id == product_id)
            )
            await event_repo.mark_processed(event_id=event_id, event_type=topic)
            await session.commit()
            await cache.delete(f"recommendations:product:{product_id}:similar")
            return

        name = str(payload.get("name") or "")
        desc = str(payload.get("description") or payload.get("shortDescription") or "")
        brand = str(payload.get("brand") or "")
        category = str(payload.get("category") or payload.get("categorySlug") or "")
        tags_raw = payload.get("tags") or []
        tags = tags_raw if isinstance(tags_raw, list) else []

        # Update pgvector product embedding
        provider = ScikitHashingEmbeddingProvider(dimensions=128)
        embedding_service = EmbeddingService(session=session, provider=provider)
        await embedding_service.index_product(
            product_id=product_id,
            name=name,
            description=desc,
            brand=brand,
            category=category,
            tags=tags,
        )

        await event_repo.mark_processed(event_id=event_id, event_type=topic)
        await session.commit()

        # Invalidate related recommendation caches
        await cache.delete(f"recommendations:product:{product_id}:similar")
        if category:
            await cache.delete(f"recommendations:category:{category}:popular")
        await cache.delete("trending:global")

        logger.info(
            "product_event_processed_successfully",
            product_id=product_id,
            topic=topic,
            event_id=event_id,
        )
