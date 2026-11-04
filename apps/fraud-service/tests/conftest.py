import os
import pytest
from httpx import ASGITransport, AsyncClient
from app.core.config import get_settings
from app.main import app
from app.redis.velocity import velocity_tracker

# Ensure test environment
os.environ["APP_ENV"] = "test"
os.environ["KAFKA_ENABLED"] = "false"
os.environ["INTERNAL_SERVICE_SECRET"] = "test-internal-secret-12345"


@pytest.fixture(autouse=True)
async def reset_velocity():
    """Resets velocity counters and Redis client before each test."""
    import app.redis.velocity as vel
    await velocity_tracker.reset()
    yield
    await velocity_tracker.reset()
    if vel._redis_client:
        try:
            await vel._redis_client.aclose()
        except Exception:
            pass
        vel._redis_client = None


@pytest.fixture
async def async_client():
    """Async test client using ASGITransport."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
