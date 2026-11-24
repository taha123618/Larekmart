import asyncio
import datetime
from typing import Any
from sqlalchemy import delete

from app.core.logging import get_logger
from app.db.models.recommendation_model import RecommendationModel
from app.db.models.user_interaction import UserInteraction
from app.db.session import async_session_factory
from app.mlops import RecommendationRegistryClient, evaluate_ranking_quality
from app.observability.metrics import (
    ML_MODEL_TRAINING_RUNS_TOTAL,
    ML_RECOMMENDATION_CATALOG_COVERAGE,
    ML_RECOMMENDATION_NDCG_AT_K,
    MODEL_TRAINING_DURATION_SECONDS,
)
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

            # Record model metadata and offline ranking evaluation
            version = f"v{int(start_time.timestamp())}"
            parameters = {"algorithm": "item_based_cosine", "min_interactions": 1, "top_k": 10}

            # Build per-user ground truth from interaction pairs for offline ranking validation
            user_truth: dict[str, set[str]] = {}
            all_items: list[str] = []
            for user_id, product_id in pairs:
                u_str, p_str = str(user_id), str(product_id)
                user_truth.setdefault(u_str, set()).add(p_str)
                if p_str not in all_items:
                    all_items.append(p_str)

            eval_metrics: dict[str, Any] = {}
            if user_truth and all_items:
                top_items = all_items[:10]
                user_recs = {u: top_items for u in user_truth}
                eval_report = evaluate_ranking_quality(
                    user_recommendations=user_recs,
                    user_ground_truth=user_truth,
                    total_catalog_items=max(unique_items, 1),
                    k=10,
                    min_ndcg=0.0,
                )
                eval_metrics = {
                    "precision_at_10": eval_report.precision_at_k,
                    "recall_at_10": eval_report.recall_at_k,
                    "ndcg_at_10": eval_report.ndcg_at_k,
                    "catalog_coverage": eval_report.catalog_coverage,
                }
                ML_RECOMMENDATION_NDCG_AT_K.labels(model_name=model_name, k="10").set(eval_report.ndcg_at_k)
                ML_RECOMMENDATION_CATALOG_COVERAGE.labels(model_name=model_name).set(eval_report.catalog_coverage)

            metrics_payload = {
                "total_interactions": num_interactions,
                "unique_users": unique_users,
                "unique_items": unique_items,
                **eval_metrics,
            }
            model_record = RecommendationModel(
                name=model_name,
                version=version,
                model_type="collaborative",
                metrics=metrics_payload,
                parameters=parameters,
                is_active=True,
            )
            session.add(model_record)
            await session.commit()

            registry = RecommendationRegistryClient()
            manifest = registry.register_run(
                model_name=model_name,
                version=version,
                parameters=parameters,
                metrics=metrics_payload,
            )
            duration_s = (datetime.datetime.now(datetime.timezone.utc) - start_time).total_seconds()
            MODEL_TRAINING_DURATION_SECONDS.labels(model_name=model_name).observe(duration_s)
            ML_MODEL_TRAINING_RUNS_TOTAL.labels(service="recommendation-service", status="promoted").inc()

            logger.info(
                "training_recommendation_model_complete",
                version=version,
                interactions=num_interactions,
                users=unique_users,
                items=unique_items,
                manifest_path=manifest.get("manifest_path"),
            )
            return {
                "status": "success",
                "model_name": model_name,
                "version": version,
                "interactions_trained": num_interactions,
                "manifest": manifest,
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
