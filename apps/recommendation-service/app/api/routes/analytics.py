from fastapi import APIRouter, Depends, status

from app.api.dependencies import get_analytics_service
from app.core.security import require_admin_or_internal
from app.schemas.analytics import AnalyticsEventCreate, StrategyMetrics
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


@router.post("/events", status_code=status.HTTP_201_CREATED)
async def record_analytics_event(
    data: AnalyticsEventCreate,
    service: AnalyticsService = Depends(get_analytics_service),
) -> dict[str, str]:
    """Records a recommendation telemetry event (impression, click, conversion)."""
    await service.record_event(data)
    return {"status": "recorded"}


@router.get("/metrics", response_model=list[StrategyMetrics])
async def get_strategy_metrics(
    service: AnalyticsService = Depends(get_analytics_service),
    _auth: dict = Depends(require_admin_or_internal),
) -> list[StrategyMetrics]:
    """Returns aggregated performance metrics (impressions, clicks, CTR, conversions) by strategy."""
    return await service.get_metrics()
