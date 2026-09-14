import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import ASGITransport, AsyncClient

from app.api.dependencies import get_cache, get_db
from app.main import app
from app.schemas.recommendation import RecommendationItem, RecommendationResponse


@pytest.mark.asyncio
async def test_health_endpoints() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test /health
        res = await client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert data["service"] == "recommendation-service"

        # Test /health/live
        live_res = await client.get("/health/live")
        assert live_res.status_code == 200
        assert live_res.json()["status"] == "alive"


@pytest.mark.asyncio
async def test_trending_recommendations_endpoint() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.all.return_value = [(101, 15.0), (102, 10.0)]
    mock_db.execute.return_value = mock_result

    mock_cache = MagicMock()
    mock_cache.get = AsyncMock(return_value=None)
    mock_cache.set = AsyncMock(return_value=True)
    mock_cache.get_json = AsyncMock(return_value=None)
    mock_cache.set_json = AsyncMock(return_value=True)
    mock_cache.global_trending_key = MagicMock(return_value="rec:trending")
    mock_cache.category_popular_key = MagicMock(return_value="rec:cat:pop")

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_cache] = lambda: mock_cache

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/recommendations/trending?limit=5")
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert "metadata" in data
        assert data["type"] == "trending"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_similar_products_endpoint() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_result.all.return_value = []
    mock_db.execute.return_value = mock_result

    mock_cache = MagicMock()
    mock_cache.product_similar_key = MagicMock(return_value="rec:prod:101:similar")
    mock_cache.get_json = AsyncMock(return_value=None)
    mock_cache.set_json = AsyncMock(return_value=True)

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_cache] = lambda: mock_cache

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/recommendations/similar/101?limit=5&categorySlug=hoodies&brand=acme")
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert data["type"] == "similar"

    app.dependency_overrides.clear()

