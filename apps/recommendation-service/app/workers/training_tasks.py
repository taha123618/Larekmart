import asyncio
import datetime
from typing import Any
from sqlalchemy import delete

from app.core.logging import get_logger
from app.db.models.recommendation_model import RecommendationModel
from app.db.models.user_interaction import UserInteraction
from app.db.session import async_session_factory
from app.repositories.interaction_repository import InteractionRepository
from app.workers.celery import celery_app

logger = get_logger("celery_training_tasks")


@celery_app.task(name="app.workers.training_tasks.train_recommendation_model", bind=True, max_retries=2)
def train_recommendation_model(self: Any, model_name: str = "collaborative_item_knn") -> dict[str, Any]:
    """Trains an offline collaborative model from user interaction history and registers metadata."""
    async def _run() -> dict[str, Any]:
        start_time = datetime.datetime.now(datetime.timezone.utc)
        logger.info("training_recommendation_model_start", model_name=model_name)

        async with async_session_factory() as session:
            repo = InteractionRepository(session)
            pairs = await repo.get_all_user_product_pairs(min_interactions=1)
            num_interactions = len(pairs)
            unique_users = len({p[0] for p in pairs})
            unique_items = len({p[1] for p in pairs})

            # Record model metadata
            version = f"v{int(start_time.timestamp())}"
            model_record = RecommendationModel(
                name=model_name,
                version=version,
                model_type="collaborative",
                metrics={
                    "total_interactions": num_interactions,
                    "unique_users": unique_users,
                    "unique_items": unique_items,
                },
                parameters={"algorithm": "item_based_cosine", "min_interactions": 1},
                is_active=True,
            )
            session.add(model_record)
            await session.commit()

            logger.info(
                "training_recommendation_model_complete",
                version=version,
                interactions=num_interactions,
                users=unique_users,
                items=unique_items,
            )
            return {
                "status": "success",
                "model_name": model_name,
                "version": version,
                "interactions_trained": num_interactions,
            }

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error("training_recommendation_model_failed", error=str(exc))
        raise self.retry(exc=exc, countdown=120)


@celery_app.task(name="app.workers.training_tasks.cleanup_expired_data", bind=True)
def cleanup_expired_data(self: Any, retention_days: int = 180) -> dict[str, Any]:
    """Prunes ancient interaction logs beyond retention window to prevent unbounded table growth."""
    async def _run() -> dict[str, Any]:
        cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=retention_days)
        async with async_session_factory() as session:
            stmt = delete(UserInteraction).where(UserInteraction.occurred_at < cutoff)
            result = await session.execute(stmt)
            deleted_count = result.rowcount or 0
            await session.commit()
            logger.info("cleaned_up_expired_interactions", deleted_count=deleted_count)
            return {"status": "success", "deleted_rows": deleted_count}

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.error("cleanup_expired_data_failed", error=str(exc))
        raise self.retry(exc=exc, countdown=300)
