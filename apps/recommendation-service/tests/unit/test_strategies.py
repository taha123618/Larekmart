import pytest
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from app.strategies.base import CandidateItem, RecommendationContext
from app.strategies.category_based import CategoryBasedStrategy
from app.strategies.popular import PopularStrategy
from app.strategies.recently_viewed import RecentlyViewedStrategy
from app.strategies.trending import TrendingStrategy


@pytest.mark.asyncio
async def test_trending_strategy() -> None:
    session = AsyncMock(spec=AsyncSession)
    strategy = TrendingStrategy(session)

    # Mock repository method
    strategy.repo.get_trending_products = AsyncMock(
        return_value=[(101, 15.0), (102, 12.0), (103, 8.5)]
    )

    ctx = RecommendationContext(limit=2)
    candidates = await strategy.recommend(ctx)

    assert len(candidates) == 2
    assert candidates[0].product_id == 101
    assert candidates[0].score == 1.0  # Max-normalized
    assert candidates[0].strategy == "trending"
    assert candidates[1].product_id == 102


@pytest.mark.asyncio
async def test_popular_strategy() -> None:
    session = AsyncMock(spec=AsyncSession)
    strategy = PopularStrategy(session)

    strategy.repo.get_popular_products = AsyncMock(
        return_value=[(201, 50.0), (202, 25.0)]
    )

    ctx = RecommendationContext(limit=10)
    candidates = await strategy.recommend(ctx)

    assert len(candidates) == 2
    assert candidates[0].product_id == 201
    assert candidates[0].score == 1.0
    assert candidates[1].product_id == 202
    assert candidates[1].score == 0.7


@pytest.mark.asyncio
async def test_recently_viewed_strategy() -> None:
    session = AsyncMock(spec=AsyncSession)
    strategy = RecentlyViewedStrategy(session)

    strategy.repo.get_recently_viewed_product_ids = AsyncMock(
        return_value=[301, 302, 303]
    )

    ctx = RecommendationContext(user_id="user_test", limit=5)
    candidates = await strategy.recommend(ctx)

    assert len(candidates) == 3
    assert candidates[0].product_id == 301
    assert candidates[0].strategy == "recently_viewed"
    assert candidates[0].score == 1.0
    assert candidates[1].score == 0.9


@pytest.mark.asyncio
async def test_category_based_strategy() -> None:
    mock_repo = AsyncMock()
    mock_repo.get_popular_products = AsyncMock(return_value=[(401, 30.0), (402, 15.0)])
    strategy = CategoryBasedStrategy(mock_repo)

    ctx = RecommendationContext(category_slug="shoes", limit=5)
    candidates = await strategy.recommend(ctx)

    assert len(candidates) == 2
    assert candidates[0].product_id == 401
    assert candidates[0].strategy == "category_based"
    assert candidates[0].category_slug == "shoes"

