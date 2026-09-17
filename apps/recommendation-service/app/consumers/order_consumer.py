from typing import Any
from app.core.logging import get_logger
from app.db.session import async_session_factory
from app.repositories.event_repository import EventRepository
from app.schemas.interaction import InteractionCreate
from app.services.interaction_service import InteractionService
from app.cache.redis import get_redis_cache

logger = get_logger("order_consumer")


async def process_order_event(topic: str, payload: dict[str, Any], event_id: str) -> None:
    """Consumes order.created, order.completed, and payment.successful events."""
    user_id = str(payload.get("userId") or payload.get("user_id") or "anonymous")
    order_id = str(payload.get("orderId") or payload.get("id") or "")
    session_id = str(payload.get("sessionId") or order_id)

    async with async_session_factory() as session:
        event_repo = EventRepository(session)
        if await event_repo.is_processed(event_id):
            logger.info("order_event_already_processed", event_id=event_id, topic=topic)
            return

        cache = get_redis_cache()
        interaction_service = InteractionService(session=session, cache=cache)

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
                    metadata={"orderId": order_id, "source": "kafka_order", "topic": topic},
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
