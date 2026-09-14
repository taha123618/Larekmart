import asyncio
import json
from typing import Any, Callable, Coroutine
from aiokafka import AIOKafkaConsumer

from app.core.config import get_settings
from app.core.logging import get_logger
from app.observability.metrics import KAFKA_EVENTS_CONSUMED_TOTAL, KAFKA_EVENTS_FAILED_TOTAL

logger = get_logger("kafka_consumer")


class KafkaConsumerManager:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.consumer: AIOKafkaConsumer | None = None
        self._running = False
        self._task: asyncio.Task[None] | None = None
        self._handlers: dict[str, Callable[[str, dict[str, Any]], Coroutine[Any, Any, None]]] = {}

    def register_handler(
        self, topic: str, handler: Callable[[str, dict[str, Any]], Coroutine[Any, Any, None]]
    ) -> None:
        self._handlers[topic] = handler

    async def start(self) -> None:
        if self.settings.app_env == "test":
            logger.info("skipping_kafka_consumer_in_test_env")
            return

        if not self._handlers:
            logger.warning("no_kafka_handlers_registered")
            return

        topics = list(self._handlers.keys())
        bootstrap_servers = self.settings.kafka_bootstrap_servers
        group_id = self.settings.kafka_consumer_group

        logger.info(
            "starting_kafka_consumer",
            bootstrap_servers=bootstrap_servers,
            group_id=group_id,
            topics=topics,
        )

        try:
            self.consumer = AIOKafkaConsumer(
                *topics,
                bootstrap_servers=bootstrap_servers,
                group_id=group_id,
                auto_offset_reset="earliest",
                enable_auto_commit=True,
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            )
            await self.consumer.start()
            self._running = True
            self._task = asyncio.create_task(self._consume_loop())
            logger.info("kafka_consumer_started_successfully", topics=topics)
        except Exception as exc:
            logger.error("failed_to_start_kafka_consumer", error=str(exc))
            # Don't crash API server if Kafka is temporarily unreachable in dev/test
            self._running = False

    async def _consume_loop(self) -> None:
        if not self.consumer:
            return

        while self._running:
            try:
                msg = await self.consumer.getone()
                topic = msg.topic
                raw_val = msg.value

                # Monorepo convention: message value might be wrapped in { value: payload }
                payload: dict[str, Any]
                if isinstance(raw_val, dict) and "value" in raw_val and isinstance(raw_val["value"], dict):
                    payload = raw_val["value"]
                elif isinstance(raw_val, dict):
                    payload = raw_val
                else:
                    payload = {"data": raw_val}

                handler = self._handlers.get(topic)
                if handler:
                    try:
                        await handler(topic, payload)
                        KAFKA_EVENTS_CONSUMED_TOTAL.labels(topic=topic, status="success").inc()
                    except Exception as handler_err:
                        KAFKA_EVENTS_FAILED_TOTAL.labels(topic=topic).inc()
                        logger.error(
                            "error_handling_kafka_event",
                            topic=topic,
                            error=str(handler_err),
                        )
            except asyncio.CancelledError:
                break
            except Exception as loop_err:
                logger.error("kafka_consumer_loop_error", error=str(loop_err))
                await asyncio.sleep(2)

    async def stop(self) -> None:
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self.consumer:
            await self.consumer.stop()
            logger.info("kafka_consumer_stopped")


# Global singleton instance
kafka_manager = KafkaConsumerManager()
