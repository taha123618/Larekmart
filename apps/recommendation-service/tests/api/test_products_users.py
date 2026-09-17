import pytest
from unittest.mock import AsyncMock, MagicMock
from httpx import ASGITransport, AsyncClient

from app.api.dependencies import get_db
from app.db.models.product_embedding import ProductEmbedding
from app.main import app


@pytest.mark.asyncio
async def test_get_product_embedding_endpoint() -> None:
    mock_db = AsyncMock()
    mock_prod = ProductEmbedding(
        product_id=101,
        name="Larekmart Cotton Hoodie",
        embedding=[0.1] * 128,
        category_slug="hoodies",
        metadata_={"brand": "Larek"},
    )
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_prod
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/products/101/embedding")
        assert res.status_code == 200
        data = res.json()
        assert data["productId"] == 101
        assert data["dimensions"] == 128
        assert data["categorySlug"] == "hoodies"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_user_preferences_endpoint() -> None:
    mock_db = AsyncMock()
    mock_result_aff = MagicMock()
    mock_result_aff.all.return_value = [("hoodies", 12.0), ("shoes", 8.0)]
    mock_result_emb = MagicMock()
    mock_result_emb.scalar_one_or_none.return_value = None
    mock_result_inter = MagicMock()
    mock_result_inter.scalars.return_value.all.return_value = []

    mock_db.execute.side_effect = [mock_result_aff, mock_result_emb, mock_result_inter]

    app.dependency_overrides[get_db] = lambda: mock_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/users/user_sample_123/preferences")
        assert res.status_code == 200
        data = res.json()
        assert data["userId"] == "user_sample_123"
        assert "categoryAffinities" in data
        assert len(data["categoryAffinities"]) == 2

    app.dependency_overrides.clear()
