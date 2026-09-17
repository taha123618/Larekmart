from app.consumers.product_consumer import process_product_event
from app.consumers.order_consumer import process_order_event
from app.consumers.interaction_consumer import process_interaction_event
from app.consumers.review_consumer import process_review_event

__all__ = [
    "process_product_event",
    "process_order_event",
    "process_interaction_event",
    "process_review_event",
]
