from typing import Any
from app.core.logging import get_logger
from app.db.session import async_session_factory
from app.repositories.event_repository import EventRepository
from app.schemas.interaction import InteractionCreate
from app.services.interaction_service import InteractionService
from app.cache.redis import get_redis_cache

logger = get_logger("interaction_consumer")


async def process_interaction_event(topic: str, payload: dict[str, Any], event_id: str) -> None:
    """Consumes product.viewed, product.searched, cart, and wishlist events."""
    user_id = str(payload.get("userId") or payload.get("user_id") or "")
    p_id = payload.get("productId") or payload.get("product_id") or payload.get("id")
    if not user_id or not p_id:
        return

    try:
        numeric_pid = int(p_id)
    except (ValueError, TypeError):
        return

    # Derive interaction event type
    topic_type_map = {
        "product.viewed": "VIEW",
        "product.searched": "SEARCH",
        "product.added_to_cart": "ADD_TO_CART",
        "product.removed_from_cart": "REMOVE_FROM_CART",
        "wishlist.product_added": "WISHLIST",
    }
    raw_type = str(payload.get("eventType") or topic_type_map.get(topic, "VIEW")).upper()
    valid_types = {
        "VIEW",
        "SEARCH",
        "WISHLIST",
        "ADD_TO_CART",
        "REMOVE_FROM_CART",
        "ORDER_COMPLETED",
        "REVIEW_CREATED",
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
                metadata=payload.get("metadata") or {"topic": topic},
            )
        )
        await event_repo.mark_processed(event_id=event_id, event_type=topic)
        await session.commit()
