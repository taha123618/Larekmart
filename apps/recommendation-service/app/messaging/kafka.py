import asyncio
import json
from typing import Any, Callable, Coroutine
from aiokafka import AIOKafkaConsumer

from app.core.config import get_settings
from app.core.logging import get_logger
from app.observability.metrics import KAFKA_EVENTS_CONSUMED_TOTAL, KAFKA_EVENTS_FAILED_TOTAL

logger = get_logger("kafka_consumer")


def _safe_json_deserialize(m: bytes | None) -> Any:
    if not m:
        return {}
    try:
        return json.loads(m.decode("utf-8"))
    except Exception as e:
        logger.warning("kafka_malformed_json_poison_pill", error=str(e))
        return {
            "_poison_pill": True,
            "_raw": m.decode("utf-8", errors="replace"),
            "_error": str(e),
        }


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
                auto_commit_interval_ms=5000,
                session_timeout_ms=self.settings.kafka_session_timeout_ms,
                heartbeat_interval_ms=self.settings.kafka_heartbeat_interval_ms,
                max_poll_interval_ms=self.settings.kafka_max_poll_interval_ms,
                request_timeout_ms=30000,
                metadata_max_age_ms=5000,
                retry_backoff_ms=500,
                value_deserializer=_safe_json_deserialize,
            )
            await self.consumer.start()
            self._running = True
            self._task = asyncio.create_task(self._consume_loop())
            logger.info("kafka_consumer_started_successfully", topics=topics)
        except Exception as exc:
            logger.error("failed_to_start_kafka_consumer_will_retry_in_background", error=str(exc))
            self.consumer = None
            self._running = True
            self._task = asyncio.create_task(self._consume_loop())

    async def _process_single_message(
        self, msg: Any, sem: asyncio.Semaphore
    ) -> None:
        async with sem:
            topic = msg.topic
            raw_val = msg.value

            if isinstance(raw_val, dict) and raw_val.get("_poison_pill"):
                KAFKA_EVENTS_FAILED_TOTAL.labels(
                    topic=topic, error_type="PoisonPillJSONDecodeError"
                ).inc()
                logger.error(
                    "poison_pill_skipped_in_recommendation_consumer",
                    topic=topic,
                    error=raw_val.get("_error"),
                )
                return

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
                    KAFKA_EVENTS_FAILED_TOTAL.labels(
                        topic=topic, error_type=type(handler_err).__name__
                    ).inc()
                    logger.error(
                        "error_handling_kafka_event",
                        topic=topic,
                        error=str(handler_err),
                    )

    async def _consume_loop(self) -> None:
        sem = asyncio.Semaphore(10)
        retry_delay = 2
        max_retry_delay = 30

        while self._running:
            try:
                if self.consumer is None:
                    topics = list(self._handlers.keys())
                    if not topics:
                        await asyncio.sleep(1)
                        continue
                    self.consumer = AIOKafkaConsumer(
                        *topics,
                        bootstrap_servers=self.settings.kafka_bootstrap_servers,
                        group_id=self.settings.kafka_consumer_group,
                        auto_offset_reset="earliest",
                        enable_auto_commit=True,
                        auto_commit_interval_ms=5000,
                        session_timeout_ms=self.settings.kafka_session_timeout_ms,
                        heartbeat_interval_ms=self.settings.kafka_heartbeat_interval_ms,
                        max_poll_interval_ms=self.settings.kafka_max_poll_interval_ms,
                        request_timeout_ms=30000,
                        metadata_max_age_ms=5000,
                        retry_backoff_ms=500,
                        value_deserializer=_safe_json_deserialize,
                    )
                    await self.consumer.start()
                    logger.info("kafka_consumer_reconnected_successfully", topics=topics)
                    retry_delay = 2

                # Batch consumption with bounded concurrency
                batch_dict = await self.consumer.getmany(timeout_ms=500, max_records=50)
                if not batch_dict:
                    await asyncio.sleep(0.05)
                    continue

                all_messages = []
                for _tp, msgs in batch_dict.items():
                    all_messages.extend(msgs)

                if all_messages:
                    await asyncio.gather(
                        *[self._process_single_message(m, sem) for m in all_messages],
                        return_exceptions=True,
                    )
            except asyncio.CancelledError:
                break
            except Exception as loop_err:
                logger.warning(
                    f"kafka_consumer_transient_warning_reconnecting_in_{retry_delay}s",
                    error=str(loop_err),
                )
                if self.consumer is not None:
                    try:
                        await self.consumer.stop()
                    except Exception:
                        pass
                    if self._handlers:
                        self.consumer = None
                if self._running:
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(max_retry_delay, retry_delay * 2)

    async def stop(self) -> None:
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        if self.consumer:
            try:
                await self.consumer.stop()
            except Exception:
                pass
            self.consumer = None
            logger.info("kafka_consumer_stopped")


# Global singleton instance
kafka_manager = KafkaConsumerManager()

from app.messaging.publishers.event_publisher import KafkaProducerManager, kafka_producer

__all__ = [
    "KafkaConsumerManager",
    "kafka_manager",
    "KafkaProducerManager",
    "kafka_producer",
]

