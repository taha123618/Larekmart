from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

AnalyticsEventType = Literal["IMPRESSION", "CLICK", "ADD_TO_CART", "PURCHASE"]


class AnalyticsEventCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    recommendation_id: str | None = Field(default=None, alias="recommendationId")
    user_id: str = Field(alias="userId", min_length=1, max_length=100)
    product_id: int = Field(alias="productId", gt=0)
    event_type: AnalyticsEventType = Field(alias="eventType")
    strategy: str = Field(default="unknown", max_length=50)
    recommendation_type: str = Field(default="personalized", alias="recommendationType", max_length=50)
    model_version: str = Field(default="v1", alias="modelVersion", max_length=50)
    position: int | None = Field(default=None, ge=0)
    score: float | None = Field(default=None, ge=0.0, le=1.0)


class StrategyMetrics(BaseModel):
    strategy: str
    impressions: int
    clicks: int
    add_to_carts: int
    purchases: int
    ctr: float
    conversion_rate: float
