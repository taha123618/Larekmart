import json
from typing import Any
from aiokafka import AIOKafkaProducer

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("kafka_producer")


class KafkaProducerManager:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.producer: AIOKafkaProducer | None = None
        self._started = False

    async def start(self) -> None:
        if self.settings.app_env == "test":
            return

        try:
            self.producer = AIOKafkaProducer(
                bootstrap_servers=self.settings.kafka_bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            )
            await self.producer.start()
            self._started = True
            logger.info("kafka_producer_started")
        except Exception as exc:
            logger.warning("kafka_producer_start_failed", error=str(exc))
            self._started = False

    async def publish(self, topic: str, payload: dict[str, Any], key: str | None = None) -> bool:
        if not self._started or not self.producer:
            logger.debug("kafka_producer_not_ready_skipping_publish", topic=topic)
            return False

        try:
            # Monorepo convention: wrap payload in { "value": payload }
            envelope = {"value": payload}
            serialized_key = key.encode("utf-8") if key else None
            await self.producer.send_and_wait(topic, value=envelope, key=serialized_key)
            logger.debug("kafka_event_published", topic=topic)
            return True
        except Exception as exc:
            logger.error("kafka_publish_failed", topic=topic, error=str(exc))
            return False

    async def stop(self) -> None:
        if self.producer and self._started:
            await self.producer.stop()
            self._started = False
            logger.info("kafka_producer_stopped")


# Global producer instance
kafka_producer = KafkaProducerManager()
