from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.db.models.analytics_event import RecommendationAnalyticsEvent
from app.observability.metrics import (
    RECOMMENDATION_CLICKS_TOTAL,
    RECOMMENDATION_CONVERSIONS_TOTAL,
    RECOMMENDATION_IMPRESSIONS_TOTAL,
)
from app.repositories.analytics_repository import AnalyticsRepository
from app.schemas.analytics import AnalyticsEventCreate, StrategyMetrics

logger = get_logger("analytics_service")


class AnalyticsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = AnalyticsRepository(session)

    async def record_event(
        self, event_data: AnalyticsEventCreate
    ) -> RecommendationAnalyticsEvent:
        event = await self.repo.record_event(
            user_id=event_data.user_id,
            product_id=event_data.product_id,
            event_type=event_data.event_type,
            strategy=event_data.strategy,
            recommendation_id=event_data.recommendation_id,
            model_version=event_data.model_version,
            position=event_data.position,
            score=event_data.score,
        )
        await self.session.commit()

        # Update Prometheus metrics
        rec_type = event_data.recommendation_type
        if event_data.event_type == "IMPRESSION":
            RECOMMENDATION_IMPRESSIONS_TOTAL.labels(
                strategy=event_data.strategy, recommendation_type=rec_type
            ).inc()
        elif event_data.event_type == "CLICK":
            RECOMMENDATION_CLICKS_TOTAL.labels(
                strategy=event_data.strategy, recommendation_type=rec_type
            ).inc()
        elif event_data.event_type in ("ADD_TO_CART", "PURCHASE"):
            RECOMMENDATION_CONVERSIONS_TOTAL.labels(
                strategy=event_data.strategy, recommendation_type=rec_type
            ).inc()

        logger.info(
            "recorded_recommendation_event",
            event_type=event_data.event_type,
            strategy=event_data.strategy,
            product_id=event_data.product_id,
            user_id=event_data.user_id,
        )
        return event

    async def get_metrics(self) -> list[StrategyMetrics]:
        return await self.repo.get_strategy_performance()
