import pytest
from unittest.mock import AsyncMock
from httpx import ASGITransport, AsyncClient

from app.api.dependencies import get_recommendation_service
from app.main import app
from app.schemas.recommendation import (
    RecommendationItem,
    RecommendationMetadata,
    RecommendationResponse,
)


@pytest.mark.asyncio
async def test_health_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        live_resp = await client.get("/health/live")
        assert live_resp.status_code == 200
        assert live_resp.json() == {"status": "alive"}

        health_resp = await client.get("/health")
        assert health_resp.status_code == 200
        data = health_resp.json()
        assert data["status"] == "healthy"
        assert data["service"] == "recommendation-service"


@pytest.mark.asyncio
async def test_e2e_personalized_recommendation_flow():
    mock_service = AsyncMock()
    mock_service.get_personalized_recommendations.return_value = RecommendationResponse(
        user_id="user_test_123",
        type="personalized",
        items=[
            RecommendationItem(
                product_id=42,
                score=0.95,
                reason="Because you viewed similar items in t-shirts",
                category_slug="t-shirts",
            ),
            RecommendationItem(
                product_id=88,
                score=0.88,
                reason="Popular among users with similar tastes",
                category_slug="hoodies",
            ),
        ],
        metadata=RecommendationMetadata(
            strategy="hybrid",
            model_version="v1",
            cached=False,
            execution_time_ms=12.5,
        ),
    )

    app.dependency_overrides[get_recommendation_service] = lambda: mock_service

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/recommendations/personalized?userId=user_test_123&limit=2")
        assert response.status_code == 200
        res_data = response.json()
        assert res_data["userId"] == "user_test_123"
        assert res_data["type"] == "personalized"
        assert len(res_data["items"]) == 2
        assert res_data["items"][0]["productId"] == 42
        assert res_data["items"][0]["score"] == 0.95
        assert res_data["metadata"]["strategy"] == "hybrid"

    app.dependency_overrides.clear()
