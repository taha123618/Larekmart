import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class RecommendationItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    product_id: int = Field(alias="productId", description="Unique product ID")
    score: float = Field(ge=0.0, le=1.0, description="Normalized recommendation confidence score")
    reason: str = Field(description="Human-readable explanation of the recommendation")
    category_slug: str | None = Field(default=None, alias="categorySlug")
    metadata: dict[str, Any] = Field(default_factory=dict)


class RecommendationMetadata(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    strategy: str = Field(description="Strategy used (e.g. hybrid, trending, collaborative)")
    model_version: str = Field(default="v1", alias="modelVersion")
    generated_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc),
        alias="generatedAt",
    )
    fallback_used: bool = Field(default=False, alias="fallbackUsed")
    cached: bool = Field(default=False)
    execution_time_ms: float = Field(default=0.0, alias="executionTimeMs")


class RecommendationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str | None = Field(default=None, alias="userId")
    recommendation_type: str = Field(alias="type", description="Type of recommendation")
    items: list[RecommendationItem] = Field(default_factory=list)
    metadata: RecommendationMetadata


class HomeRecommendationsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    user_id: str | None = Field(default=None, alias="userId")
    trending: RecommendationResponse
    popular: RecommendationResponse
    personalized: RecommendationResponse | None = None
    recently_viewed: RecommendationResponse | None = Field(default=None, alias="recentlyViewed")
