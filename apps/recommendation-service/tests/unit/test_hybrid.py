import pytest
from unittest.mock import AsyncMock, MagicMock

from app.strategies.base import CandidateItem, RecommendationContext
from app.strategies.hybrid import HybridStrategy


@pytest.mark.asyncio
async def test_hybrid_strategy_blending() -> None:
    collab = MagicMock()
    collab.recommend = AsyncMock(
        return_value=[
            CandidateItem(product_id=1, score=0.9, reason="Collab match", strategy="collab"),
            CandidateItem(product_id=2, score=0.5, reason="Collab match", strategy="collab"),
        ]
    )

    content = MagicMock()
    content.recommend = AsyncMock(
        return_value=[
            CandidateItem(product_id=2, score=0.8, reason="Content match", strategy="content"),
            CandidateItem(product_id=3, score=0.6, reason="Content match", strategy="content"),
        ]
    )

    embedding = MagicMock()
    embedding.recommend = AsyncMock(return_value=[])

    category = MagicMock()
    category.recommend = AsyncMock(return_value=[])

    trending = MagicMock()
    trending.recommend = AsyncMock(return_value=[])

    popular = MagicMock()
    popular.recommend = AsyncMock(return_value=[])

    hybrid = HybridStrategy(
        collaborative_strategy=collab,
        content_strategy=content,
        embedding_strategy=embedding,
        category_strategy=category,
        trending_strategy=trending,
        popular_strategy=popular,
    )

    ctx = RecommendationContext(user_id="user_1", limit=3)
    results = await hybrid.recommend(ctx)

    assert len(results) == 3
    # Product 1 gets score 0.45, Product 2 gets 0.375, Product 3 gets 0.30
    assert results[0].product_id == 1
    assert results[0].score == 0.45
    assert results[0].strategy == "hybrid"
    assert results[1].product_id == 2
    assert results[1].score == 0.375
    assert results[2].product_id == 3
