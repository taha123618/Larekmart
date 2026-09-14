import math
import pytest
from app.embeddings.provider import ScikitHashingEmbeddingProvider


@pytest.mark.asyncio
async def test_embedding_dimensions_and_norm(
    embedding_provider: ScikitHashingEmbeddingProvider,
) -> None:
    text = "Men Classic Slim Fit Oxford Cotton Shirt Blue"
    vector = await embedding_provider.embed(text)

    # 1. Dimension check
    assert len(vector) == 128

    # 2. L2 norm check (sum of squares should be approximately 1.0)
    norm = math.sqrt(sum(x * x for x in vector))
    assert abs(norm - 1.0) < 1e-4


@pytest.mark.asyncio
async def test_embedding_deterministic(
    embedding_provider: ScikitHashingEmbeddingProvider,
) -> None:
    text = "Nike Air Max running sneakers black"
    vec1 = await embedding_provider.embed(text)
    vec2 = await embedding_provider.embed(text)

    assert vec1 == vec2


@pytest.mark.asyncio
async def test_embedding_batch(
    embedding_provider: ScikitHashingEmbeddingProvider,
) -> None:
    texts = [
        "Cotton Crewneck T-Shirt White",
        "Wool Cashmere Blend Winter Coat Charcoal",
    ]
    vectors = await embedding_provider.embed_batch(texts)

    assert len(vectors) == 2
    assert len(vectors[0]) == 128
    assert len(vectors[1]) == 128
    assert vectors[0] != vectors[1]


@pytest.mark.asyncio
async def test_embedding_service_initialization_with_session() -> None:
    from unittest.mock import AsyncMock
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.embeddings.service import EmbeddingService

    mock_session = AsyncMock(spec=AsyncSession)
    provider = ScikitHashingEmbeddingProvider(dimensions=128)
    service = EmbeddingService(session=mock_session, provider=provider)

    assert service.embedding_repo is not None
    assert service.interaction_repo is not None
    assert service.provider == provider

