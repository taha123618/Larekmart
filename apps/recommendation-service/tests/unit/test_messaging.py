import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.messaging.consumers.event_consumer import (
    _generate_event_id,
    handle_product_event,
    register_all_consumers,
)
from app.messaging.publishers.event_publisher import KafkaProducerManager


def test_generate_event_id() -> None:
    # Deterministic event ID generator
    payload_with_id = {"eventId": "evt_12345", "name": "test"}
    assert _generate_event_id("product.created", payload_with_id) == "evt_12345"

    payload_without_id = {"foo": "bar"}
    event_id = _generate_event_id("product.viewed", payload_without_id)
    assert event_id.startswith("product.viewed_")


@pytest.mark.asyncio
async def test_kafka_producer_publish() -> None:
    producer_mgr = KafkaProducerManager()
    producer_mgr._started = True
    mock_producer = AsyncMock()
    producer_mgr.producer = mock_producer

    success = await producer_mgr.publish(
        topic="test.topic",
        payload={"productId": 101, "name": "Item"},
        key="101",
    )
    assert success is True
    mock_producer.send_and_wait.assert_awaited_once_with(
        "test.topic",
        value={"value": {"productId": 101, "name": "Item"}},
        key=b"101",
    )


def test_register_all_consumers() -> None:
    with patch("app.messaging.kafka.kafka_manager.register_handler") as mock_reg:
        register_all_consumers()
        registered_topics = [call.args[0] for call in mock_reg.call_args_list]

        assert "product.created" in registered_topics
        assert "order.completed" in registered_topics
        assert "product.viewed" in registered_topics
        assert "review.created" in registered_topics


@pytest.mark.asyncio
async def test_kafka_consumer_concurrent_batch_processing() -> None:
    from app.messaging.kafka import KafkaConsumerManager
    import asyncio
    from unittest.mock import MagicMock

    mgr = KafkaConsumerManager()
    mgr._running = True

    handled_items: list[int] = []

    async def mock_handler(topic: str, payload: dict) -> None:
        await asyncio.sleep(0.01)
        handled_items.append(payload["id"])

    mgr.register_handler("test.batch", mock_handler)

    class MockMsg:
        def __init__(self, item_id: int):
            self.topic = "test.batch"
            self.value = {"value": {"id": item_id}}

    mock_consumer = AsyncMock()
    # First getmany returns 5 messages, second iteration breaks loop
    batch_records = {
        "tp1": [MockMsg(1), MockMsg(2), MockMsg(3), MockMsg(4), MockMsg(5)]
    }

    call_count = 0
    async def mock_getmany(timeout_ms: int, max_records: int):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return batch_records
        mgr._running = False
        return {}

    mock_consumer.getmany = mock_getmany
    mgr.consumer = mock_consumer

    await mgr._consume_loop()

    assert len(handled_items) == 5
    assert set(handled_items) == {1, 2, 3, 4, 5}

