from typing import Any
from app.core.logging import get_logger
from app.db.session import async_session_factory
from app.repositories.event_repository import EventRepository
from app.schemas.interaction import InteractionCreate
from app.services.interaction_service import InteractionService
from app.cache.redis import get_redis_cache

logger = get_logger("review_consumer")


async def process_review_event(topic: str, payload: dict[str, Any], event_id: str) -> None:
    """Consumes review.created events."""
    user_id = str(payload.get("userId") or payload.get("user_id") or "")
    p_id = payload.get("productId") or payload.get("product_id")
    if not user_id or not p_id:
        return

    try:
        numeric_pid = int(p_id)
    except (ValueError, TypeError):
        return

    rating = float(payload.get("rating") or 5.0)

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
                eventType="REVIEW_CREATED",
                eventId=event_id,
                sessionId=payload.get("sessionId"),
                metadata={"rating": rating, "comment": payload.get("comment"), "source": "review_event"},
            )
        )
        await event_repo.mark_processed(event_id=event_id, event_type=topic)
        await session.commit()
