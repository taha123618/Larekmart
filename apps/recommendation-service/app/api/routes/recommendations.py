from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_recommendation_service
from app.schemas.recommendation import (
    HomeRecommendationsResponse,
    RecommendationResponse,
)
from app.services.recommendation_service import RecommendationService

router = APIRouter(prefix="/api/v1/recommendations", tags=["Recommendations"])


@router.get("/home", response_model=HomeRecommendationsResponse)
async def get_home_recommendations(
    user_id: str | None = Query(default=None, alias="userId", description="Optional user identifier"),
    limit: int = Query(default=10, ge=1, le=50),
    service: RecommendationService = Depends(get_recommendation_service),
) -> HomeRecommendationsResponse:
    """Aggregated home feed recommendations with personalized, trending, and popular sections."""
    return await service.get_home_recommendations(user_id=user_id, limit=limit)


@router.get("/personalized", response_model=RecommendationResponse)
async def get_personalized_recommendations(
    user_id: str = Query(..., alias="userId", min_length=1, description="Target user identifier"),
    limit: int = Query(default=10, ge=1, le=50),
    service: RecommendationService = Depends(get_recommendation_service),
) -> RecommendationResponse:
    """Personalized recommendations powered by hybrid collaborative, content, and vector affinity."""
    return await service.get_personalized_recommendations(user_id=user_id, limit=limit)


@router.get("/trending", response_model=RecommendationResponse)
async def get_trending_recommendations(
    limit: int = Query(default=10, ge=1, le=50),
    window_hours: int = Query(default=48, ge=1, le=168, alias="windowHours"),
    category_slug: str | None = Query(default=None, alias="categorySlug"),
    service: RecommendationService = Depends(get_recommendation_service),
) -> RecommendationResponse:
    """Trending products calculated by recent interaction and sales velocity with decay."""
    return await service.get_trending_recommendations(
        limit=limit, window_hours=window_hours, category_slug=category_slug
    )


@router.get("/popular", response_model=RecommendationResponse)
async def get_popular_recommendations(
    limit: int = Query(default=10, ge=1, le=50),
    category_slug: str | None = Query(default=None, alias="categorySlug"),
    service: RecommendationService = Depends(get_recommendation_service),
) -> RecommendationResponse:
    """Popular products by all-time engagement and purchase volume."""
    return await service.get_popular_recommendations(
        limit=limit, category_slug=category_slug
    )


@router.get("/similar/{product_id}", response_model=RecommendationResponse)
async def get_similar_products(
    product_id: int,
    limit: int = Query(default=10, ge=1, le=50),
    category_slug: str | None = Query(default=None, alias="categorySlug"),
    brand: str | None = Query(default=None),
    service: RecommendationService = Depends(get_recommendation_service),
) -> RecommendationResponse:
    """Similar products using vector cosine similarity over product embeddings and metadata."""
    return await service.get_similar_products(
        product_id=product_id, limit=limit, category_slug=category_slug, brand=brand
    )


@router.get("/product/{product_id}", response_model=RecommendationResponse)
async def get_product_page_recommendations(
    product_id: int,
    limit: int = Query(default=10, ge=1, le=50),
    category_slug: str | None = Query(default=None, alias="categorySlug"),
    service: RecommendationService = Depends(get_recommendation_service),
) -> RecommendationResponse:
    """Convenience alias for product page recommendations (similar items + fallbacks)."""
    return await service.get_similar_products(
        product_id=product_id, limit=limit, category_slug=category_slug
    )


@router.get("/frequently-bought-together/{product_id}", response_model=RecommendationResponse)
async def get_frequently_bought_together(
    product_id: int,
    limit: int = Query(default=5, ge=1, le=20),
    service: RecommendationService = Depends(get_recommendation_service),
) -> RecommendationResponse:
    """Products frequently purchased or carted together in identical sessions."""
    return await service.get_frequently_bought_together(product_id=product_id, limit=limit)


@router.get("/category/{category_id}", response_model=RecommendationResponse)
async def get_category_recommendations(
    category_id: str,
    limit: int = Query(default=10, ge=1, le=50),
    service: RecommendationService = Depends(get_recommendation_service),
) -> RecommendationResponse:
    """Recommendations filtered to a specific category."""
    return await service.get_category_recommendations(category_slug=category_id, limit=limit)


@router.get("/recently-viewed", response_model=RecommendationResponse)
async def get_recently_viewed(
    user_id: str = Query(..., alias="userId", min_length=1),
    limit: int = Query(default=10, ge=1, le=50),
    service: RecommendationService = Depends(get_recommendation_service),
) -> RecommendationResponse:
    """Recently viewed products by the specified user."""
    return await service.get_recently_viewed(user_id=user_id, limit=limit)
