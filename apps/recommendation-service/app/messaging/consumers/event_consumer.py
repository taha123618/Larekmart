import hashlib
import json
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache.redis import get_redis_cache
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.session import async_session_factory
from app.embeddings.provider import ScikitHashingEmbeddingProvider
from app.embeddings.service import EmbeddingService
from app.repositories.embedding_repository import EmbeddingRepository
from app.repositories.event_repository import EventRepository
from app.repositories.interaction_repository import InteractionRepository
from app.schemas.interaction import InteractionCreate
from app.services.interaction_service import InteractionService

logger = get_logger("event_consumer")


def _generate_event_id(topic: str, payload: dict[str, Any]) -> str:
    """Fallback event ID generator using deterministic payload hashing."""
    if "eventId" in payload:
        return str(payload["eventId"])
    if "event_id" in payload:
        return str(payload["event_id"])
    if "id" in payload and "timestamp" in payload:
        return f"{topic}_{payload['id']}_{payload['timestamp']}"
    # Hash payload representation
    raw_str = json.dumps(payload, sort_keys=True, default=str)
    hashed = hashlib.sha256(raw_str.encode()).hexdigest()[:16]
    return f"{topic}_{hashed}"


async def handle_product_event(topic: str, payload: dict[str, Any]) -> None:
    """Handles product.created and product.updated events to update embeddings."""
    event_id = _generate_event_id(topic, payload)
    product_id = payload.get("id") or payload.get("productId")
    if not product_id:
        logger.warning("product_event_missing_id", topic=topic, payload=payload)
        return

    try:
        product_id = int(product_id)
    except (ValueError, TypeError):
        logger.warning("invalid_product_id_format", product_id=product_id)
        return

    async with async_session_factory() as session:
        event_repo = EventRepository(session)
        if await event_repo.is_processed(event_id):
            logger.info("event_already_processed", event_id=event_id, topic=topic)
            return

        # Generate embedding
        provider = ScikitHashingEmbeddingProvider(dimensions=128)
        embedding_service = EmbeddingService(session=session, provider=provider)

        name = str(payload.get("name") or "")
        desc = str(payload.get("description") or payload.get("shortDescription") or "")
        brand = str(payload.get("brand") or "")
        category = str(payload.get("category") or payload.get("categorySlug") or "")
        tags_raw = payload.get("tags") or []
        tags = tags_raw if isinstance(tags_raw, list) else []

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

        # Invalidate related cache
        cache = get_redis_cache()
        await cache.delete(f"recommendations:product:{product_id}:similar")
        if category:
            await cache.delete(f"recommendations:category:{category}:popular")

        logger.info(
            "product_event_processed_successfully",
            product_id=product_id,
            topic=topic,
            event_id=event_id,
        )


async def handle_payment_or_order_event(topic: str, payload: dict[str, Any]) -> None:
    """Handles payment.successful and order.created events to record interactions."""
    event_id = _generate_event_id(topic, payload)
    user_id = str(payload.get("userId") or payload.get("user_id") or "anonymous")
    order_id = str(payload.get("orderId") or payload.get("id") or "")
    session_id = str(payload.get("sessionId") or order_id)

    async with async_session_factory() as session:
        event_repo = EventRepository(session)
        if await event_repo.is_processed(event_id):
            logger.info("event_already_processed", event_id=event_id, topic=topic)
            return

        cache = get_redis_cache()
        interaction_service = InteractionService(session=session, cache=cache)

        # Extract items
        items = (
            payload.get("cart")
            or payload.get("orderItems")
            or payload.get("products")
            or payload.get("items")
            or []
        )

        for item in items:
            p_id = item.get("id") or item.get("productId") or item.get("product_id")
            if not p_id:
                continue
            try:
                numeric_pid = int(p_id)
            except (ValueError, TypeError):
                continue

            await interaction_service.record_interaction(
                InteractionCreate(
                    userId=user_id,
                    productId=numeric_pid,
                    eventType="ORDER_COMPLETED",
                    eventId=f"{event_id}_{numeric_pid}",
                    sessionId=session_id,
                    metadata={"orderId": order_id, "source": "kafka_order"},
                )
            )

        await event_repo.mark_processed(event_id=event_id, event_type=topic)
        await session.commit()

        logger.info(
            "order_event_processed_successfully",
            order_id=order_id,
            user_id=user_id,
            item_count=len(items),
            event_id=event_id,
        )


async def handle_user_interaction_event(topic: str, payload: dict[str, Any]) -> None:
    """Handles product.viewed, cart.updated, and other interaction events."""
    event_id = _generate_event_id(topic, payload)
    user_id = str(payload.get("userId") or payload.get("user_id") or "")
    p_id = payload.get("productId") or payload.get("product_id") or payload.get("id")
    if not user_id or not p_id:
        return

    try:
        numeric_pid = int(p_id)
    except (ValueError, TypeError):
        return

    raw_type = str(payload.get("eventType") or "VIEW").upper()
    valid_types = {
        "VIEW", "SEARCH", "WISHLIST", "ADD_TO_CART", "REMOVE_FROM_CART", "ORDER_COMPLETED", "REVIEW_CREATED"
    }
    event_type = raw_type if raw_type in valid_types else "VIEW"

    async with async_session_factory() as session:
        event_repo = EventRepository(session)
        if await event_repo.is_processed(event_id):
            return

        cache = get_redis_cache()
        interaction_service = InteractionService(session=session, cache=cache)
        await interaction_service.record_interaction(
            InteractionCreate(
                userId=user_id,
                productId=numeric_pid,
                eventType=event_type,  # type: ignore[arg-type]
                eventId=event_id,
                sessionId=payload.get("sessionId"),
                metadata=payload.get("metadata") or {},
            )
        )
        await event_repo.mark_processed(event_id=event_id, event_type=topic)
        await session.commit()


def register_all_consumers() -> None:
    """Registers topic handlers with the global kafka manager."""
    from app.messaging.kafka import kafka_manager

    settings = get_settings()

    # Product topics
    kafka_manager.register_handler("product.created", handle_product_event)
    kafka_manager.register_handler("product.updated", handle_product_event)

    # Order/Payment topics
    kafka_manager.register_handler("payment.successful", handle_payment_or_order_event)
    kafka_manager.register_handler("payment-successful", handle_payment_or_order_event)
    kafka_manager.register_handler("order.created", handle_payment_or_order_event)
    kafka_manager.register_handler("order-successful", handle_payment_or_order_event)

    # User interactions topic
    kafka_manager.register_handler("product.viewed", handle_user_interaction_event)
    kafka_manager.register_handler("recommendation.interaction", handle_user_interaction_event)

    logger.info("all_kafka_consumers_registered")
