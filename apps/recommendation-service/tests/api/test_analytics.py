import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import ASGITransport, AsyncClient

from app.api.dependencies import get_db
from app.main import app


@pytest.mark.asyncio
async def test_record_analytics_event_endpoint() -> None:
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    payload = {
        "recommendationId": "rec_123",
        "userId": "user_789",
        "productId": 101,
        "eventType": "CLICK",
        "strategy": "hybrid",
        "modelVersion": "v1",
        "position": 0,
        "score": 0.95,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/v1/analytics/events", json=payload)
        assert res.status_code == 201
        assert res.json() == {"status": "recorded"}

    app.dependency_overrides.clear()
