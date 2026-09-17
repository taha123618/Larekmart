import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import ASGITransport, AsyncClient

from app.api.dependencies import get_cache, get_db
from app.db.models.user_interaction import UserInteraction
from app.main import app


@pytest.mark.asyncio
async def test_record_interaction_endpoint() -> None:
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_cache = MagicMock()
    mock_cache.delete = AsyncMock(return_value=True)

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_cache] = lambda: mock_cache

    payload = {
        "userId": "user_456",
        "productId": 99,
        "eventType": "ADD_TO_CART",
        "sessionId": "sess_abc",
        "metadata": {"source": "pdp"},
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/interactions", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["userId"] == "user_456"
        assert data["productId"] == 99
        assert data["eventType"] == "ADD_TO_CART"
        assert data["weight"] == 6.0

    app.dependency_overrides.clear()
