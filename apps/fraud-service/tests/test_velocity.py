import pytest
import time
from app.redis.velocity import velocity_tracker


@pytest.mark.asyncio
async def test_velocity_counter_increments():
    key = "test_user_01"
    assert await velocity_tracker.get_velocity(key) == 0

    count1 = await velocity_tracker.record_event(key)
    assert count1 == 1

    count2 = await velocity_tracker.record_event(key)
    assert count2 == 2

    assert await velocity_tracker.get_velocity(key) == 2


@pytest.mark.asyncio
async def test_velocity_window_expiration():
    key = "test_user_expire"
    # Event 10 seconds ago with window 5 seconds
    now = time.time()
    await velocity_tracker.record_event(key, timestamp=now - 10)
    # Check with 5s window
    count = await velocity_tracker.get_velocity(key, window_seconds=5)
    assert count == 0

    # Add fresh event
    await velocity_tracker.record_event(key, timestamp=now)
    count_fresh = await velocity_tracker.get_velocity(key, window_seconds=5)
    assert count_fresh == 1

