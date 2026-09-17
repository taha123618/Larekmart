"""Background workers and Celery tasks."""

from app.workers.celery import celery_app
from app.workers.embedding_tasks import (
    generate_product_embedding,
    generate_user_embedding,
)
from app.workers.recommendation_tasks import (
    calculate_popular_products,
    calculate_trending_products,
    refresh_user_recommendations,
)
from app.workers.training_tasks import (
    cleanup_expired_data,
    train_recommendation_model,
)

__all__ = [
    "celery_app",
    "calculate_trending_products",
    "calculate_popular_products",
    "refresh_user_recommendations",
    "generate_product_embedding",
    "generate_user_embedding",
    "train_recommendation_model",
    "cleanup_expired_data",
]

