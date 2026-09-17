from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.analytics_event import RecommendationAnalyticsEvent
from app.schemas.analytics import StrategyMetrics


class AnalyticsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def record_event(
        self,
        user_id: str,
        product_id: int,
        event_type: str,
        strategy: str,
        recommendation_id: str | None = None,
        model_version: str = "v1",
        position: int | None = None,
        score: float | None = None,
    ) -> RecommendationAnalyticsEvent:
        event = RecommendationAnalyticsEvent(
            user_id=user_id,
            product_id=product_id,
            event_type=event_type,
            strategy=strategy,
            recommendation_id=recommendation_id,
            model_version=model_version,
            position=position,
            score=score,
        )
        self.session.add(event)
        await self.session.flush()
        return event

    async def get_strategy_performance(self) -> list[StrategyMetrics]:
        """Aggregates impressions, clicks, conversions and calculates CTR by strategy."""
        stmt = (
            select(
                RecommendationAnalyticsEvent.strategy,
                func.count().filter(RecommendationAnalyticsEvent.event_type == "IMPRESSION").label("impressions"),
                func.count().filter(RecommendationAnalyticsEvent.event_type == "CLICK").label("clicks"),
                func.count().filter(RecommendationAnalyticsEvent.event_type == "ADD_TO_CART").label("add_to_carts"),
                func.count().filter(RecommendationAnalyticsEvent.event_type == "PURCHASE").label("purchases"),
            )
            .group_by(RecommendationAnalyticsEvent.strategy)
        )
        result = await self.session.execute(stmt)

        metrics_list: list[StrategyMetrics] = []
        for row in result.all():
            strat = row[0]
            imps = int(row[1])
            clicks = int(row[2])
            carts = int(row[3])
            purchases = int(row[4])
            ctr = (clicks / imps) if imps > 0 else 0.0
            conv = (purchases / imps) if imps > 0 else 0.0
            metrics_list.append(
                StrategyMetrics(
                    strategy=strat,
                    impressions=imps,
                    clicks=clicks,
                    add_to_carts=carts,
                    purchases=purchases,
                    ctr=round(ctr, 4),
                    conversion_rate=round(conv, 4),
                )
            )
        return metrics_list
