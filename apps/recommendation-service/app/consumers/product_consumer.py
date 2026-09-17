from typing import Any
from app.core.logging import get_logger
from app.db.session import async_session_factory
from app.db.models.product import Product
from app.embeddings.provider import ScikitHashingEmbeddingProvider
from app.embeddings.service import EmbeddingService
from app.repositories.event_repository import EventRepository
from app.cache.redis import get_redis_cache

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

        if topic == "product.deleted":
            # Deactivate or remove product
            existing_prod = await session.get(Product, product_id)
            if existing_prod:
                existing_prod.is_active = False
            await event_repo.mark_processed(event_id=event_id, event_type=topic)
            await session.commit()
            cache = get_redis_cache()
            await cache.delete(f"recommendations:product:{product_id}:similar")
            return

        # Update local product catalog cache
        name = str(payload.get("name") or "")
        desc = str(payload.get("description") or payload.get("shortDescription") or "")
        brand = str(payload.get("brand") or "")
        category = str(payload.get("category") or payload.get("categorySlug") or "")
        price = float(payload.get("price") or 0.0)
        tags_raw = payload.get("tags") or []
        tags = tags_raw if isinstance(tags_raw, list) else []

        prod = await session.get(Product, product_id)
        if not prod:
            prod = Product(
                id=product_id,
                name=name,
                description=desc,
                brand=brand,
                category_slug=category,
                price=price,
                is_active=True,
                tags=tags,
                metadata_=payload,
            )
            session.add(prod)
        else:
            prod.name = name
            prod.description = desc
            prod.brand = brand
            prod.category_slug = category
            prod.price = price
            prod.tags = tags
            prod.metadata_ = payload

        # Update pgvector embedding
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
        cache = get_redis_cache()
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
