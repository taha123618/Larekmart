import hashlib
import json
from typing import Any

from app.consumers.interaction_consumer import process_interaction_event
from app.consumers.order_consumer import process_order_event
from app.consumers.product_consumer import process_product_event
from app.consumers.review_consumer import process_review_event
from app.core.config import get_settings
from app.core.logging import get_logger

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
    """Handles product catalog events (created, updated, deleted)."""
    event_id = _generate_event_id(topic, payload)
    await process_product_event(topic=topic, payload=payload, event_id=event_id)


async def handle_payment_or_order_event(topic: str, payload: dict[str, Any]) -> None:
    """Handles order and payment completion events."""
    event_id = _generate_event_id(topic, payload)
    await process_order_event(topic=topic, payload=payload, event_id=event_id)


async def handle_user_interaction_event(topic: str, payload: dict[str, Any]) -> None:
    """Handles behavioral interactions (viewed, searched, cart, wishlist)."""
    event_id = _generate_event_id(topic, payload)
    await process_interaction_event(topic=topic, payload=payload, event_id=event_id)


async def handle_review_event(topic: str, payload: dict[str, Any]) -> None:
    """Handles review.created events."""
    event_id = _generate_event_id(topic, payload)
    await process_review_event(topic=topic, payload=payload, event_id=event_id)


def register_all_consumers() -> None:
    """Registers topic handlers with the global kafka manager."""
    from app.messaging.kafka import kafka_manager

    settings = get_settings()

    # Product topics
    kafka_manager.register_handler("product.created", handle_product_event)
    kafka_manager.register_handler("product.updated", handle_product_event)
    kafka_manager.register_handler("product.deleted", handle_product_event)

    # Order/Payment topics
    kafka_manager.register_handler("payment.successful", handle_payment_or_order_event)
    kafka_manager.register_handler("payment-successful", handle_payment_or_order_event)
    kafka_manager.register_handler("order.created", handle_payment_or_order_event)
    kafka_manager.register_handler("order.completed", handle_payment_or_order_event)
    kafka_manager.register_handler("order-successful", handle_payment_or_order_event)

    # User behavioral interaction topics
    kafka_manager.register_handler("product.viewed", handle_user_interaction_event)
    kafka_manager.register_handler("product.searched", handle_user_interaction_event)
    kafka_manager.register_handler("product.added_to_cart", handle_user_interaction_event)
    kafka_manager.register_handler("product.removed_from_cart", handle_user_interaction_event)
    kafka_manager.register_handler("wishlist.product_added", handle_user_interaction_event)
    kafka_manager.register_handler("recommendation.interaction", handle_user_interaction_event)

    # Review topics
    kafka_manager.register_handler("review.created", handle_review_event)

    logger.info("all_kafka_consumers_registered")
