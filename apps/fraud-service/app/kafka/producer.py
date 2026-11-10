import asyncio
import json
from typing import Any
from aiokafka import AIOKafkaProducer
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("fraud-service.kafka-producer")

_producer: AIOKafkaProducer | None = None


async def get_kafka_producer() -> AIOKafkaProducer | None:
    global _producer
    settings = get_settings()
    if not settings.KAFKA_ENABLED:
        return None

    try:
        current_loop = asyncio.get_running_loop()
        if _producer is not None:
            producer_loop = getattr(_producer, "_loop", None)
            if producer_loop is not None and producer_loop is not current_loop:
                try:
                    await _producer.stop()
                except Exception:
                    pass
                _producer = None
    except RuntimeError:
        pass

    if _producer is None:
        try:
            _producer = AIOKafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(","),
                client_id=settings.KAFKA_CLIENT_ID,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            )
            await _producer.start()
            logger.info("AIOKafkaProducer started successfully")
        except Exception as e:
            logger.warn("Could not connect to Kafka producer; events will be logged", error=str(e))
            _producer = None

    return _producer


async def emit_fraud_event(topic: str, payload: dict[str, Any]) -> None:
    """
    Publishes an event to Kafka adhering to the { value: payload } envelope convention.
    """
    settings = get_settings()
    producer = await get_kafka_producer()

    if producer:
        try:
            # Monorepo convention: value is the JSON payload
            await producer.send_and_wait(topic, value={"value": payload})
            logger.debug("Emitted Kafka event", topic=topic, entity_id=payload.get("entityId"))
        except Exception as e:
            logger.error("Failed to emit Kafka event", topic=topic, error=str(e))
    else:
        logger.info("[MOCK KAFKA] Emitted fraud event", topic=topic, payload=payload)


async def stop_kafka_producer() -> None:
    global _producer
    if _producer:
        try:
            await _producer.stop()
        except Exception:
            pass
        _producer = None

