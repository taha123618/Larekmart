import os
import pytest
from unittest.mock import AsyncMock, MagicMock

# Set test environment variables before importing app
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "postgresql+asyncpg://postgres:postgres@localhost:5432/test_rec_db"
os.environ["REDIS_URL"] = "redis://localhost:6379/15"

from app.cache.redis import RedisCache
from app.embeddings.provider import ScikitHashingEmbeddingProvider


@pytest.fixture
def embedding_provider() -> ScikitHashingEmbeddingProvider:
    return ScikitHashingEmbeddingProvider(dimensions=128)


@pytest.fixture
def mock_cache() -> MagicMock:
    cache = MagicMock(spec=RedisCache)
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock(return_value=True)
    cache.delete = AsyncMock(return_value=True)
    cache.ping = AsyncMock(return_value=True)
    return cache
