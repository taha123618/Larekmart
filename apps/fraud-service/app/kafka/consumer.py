import asyncio
import json
from typing import Any
from aiokafka import AIOKafkaConsumer
from app.core.config import get_settings
from app.core.logging import get_logger
from app.observability.metrics import (
    KAFKA_EVENTS_CONSUMED_TOTAL,
    KAFKA_EVENTS_FAILED_TOTAL,
)
from app.redis.velocity import velocity_tracker
from app.schemas.fraud import AssessRiskRequest
from app.services.fraud_service import fraud_service

logger = get_logger("fraud-service.kafka-consumer")


def _safe_json_deserialize(v: bytes | None) -> Any:
    if not v:
        return {}
    try:
        return json.loads(v.decode("utf-8"))
    except Exception as e:
        logger.warning("kafka_malformed_json_poison_pill", error=str(e))
        return {
            "_poison_pill": True,
            "_raw": v.decode("utf-8", errors="replace"),
            "_error": str(e),
        }

_consumer_task: asyncio.Task | None = None
_running: bool = False


async def _process_single_message(msg: Any, sem: asyncio.Semaphore) -> None:
    async with sem:
        if isinstance(msg.value, dict) and msg.value.get("_poison_pill"):
            KAFKA_EVENTS_FAILED_TOTAL.labels(
                topic=msg.topic, error_type="PoisonPillJSONDecodeError"
            ).inc()
            logger.error(
                "poison_pill_skipped_in_fraud_consumer",
                topic=msg.topic,
                error=msg.value.get("_error"),
            )
            return

        payload = (
            msg.value.get("value", msg.value)
            if isinstance(msg.value, dict)
            else {}
        )
        topic = msg.topic

        # Synthetic canary probe check: Drop synthetic test orders to prevent model/velocity pollution
        is_synthetic = False
        if isinstance(payload, dict):
            if (
                payload.get("userId") == "usr_synthetic_canary_daemon"
                or payload.get("isSynthetic")
                or payload.get("x-synthetic-probe")
            ):
                is_synthetic = True
        if hasattr(msg, "headers") and msg.headers:
            for k, v in msg.headers:
                if k == "x-synthetic-probe" and (v == b"true" or v == "true"):
                    is_synthetic = True
                    break

        if is_synthetic:
            KAFKA_EVENTS_CONSUMED_TOTAL.labels(
                topic=topic, status="synthetic_skipped"
            ).inc()
            return

        try:
            # 1. Order Checkout Stream Processing
            if topic == "order.created":
                user_id = str(payload.get("userId") or "")
                order_id = str(payload.get("orderId") or payload.get("id") or "")
                amount_raw = payload.get("amount") or payload.get("totalAmount") or 0
                amount = (
                    float(amount_raw) / 100.0
                    if amount_raw > 10000
                    else float(amount_raw)
                )
                payment_method = str(
                    payload.get("paymentMethod")
                    or ("cod" if payload.get("isCod") else "card")
                )
                device_fp = payload.get("deviceFingerprint")

                if user_id:
                    await velocity_tracker.record_event(f"user:{user_id}")
                if device_fp:
                    await velocity_tracker.record_event(f"dfp:{device_fp}")

                if order_id and user_id:
                    assess_req = AssessRiskRequest(
                        workflow="ORDER",
                        entityId=order_id,
                        entityType="ORDER",
                        userId=user_id,
                        amount=amount,
                        currency=str(payload.get("currency") or "PKR"),
                        paymentMethod=payment_method,
                        deviceFingerprint=device_fp,
                        metadata={
                            "email": payload.get("email"),
                            "isCod": payload.get("isCod", False),
                            "carrier": payload.get("carrier"),
                        },
                    )
                    await fraud_service.assess_risk(assess_req)

            # 2. Successful Payment Stream Processing
            elif topic == "payment.successful":
                user_id = str(payload.get("userId") or "")
                device_fp = payload.get("deviceFingerprint")
                if user_id:
                    await velocity_tracker.record_event(f"user:{user_id}")
                if device_fp:
                    await velocity_tracker.record_event(f"dfp:{device_fp}")

            # 3. Payment Failure & Brute Force Carding Detection
            elif topic == "payment.failed":
                user_id = str(payload.get("userId") or "")
                if user_id:
                    fail_count = await velocity_tracker.record_event(
                        f"payment_failure:{user_id}"
                    )
                    if fail_count >= 4:
                        session_id = str(
                            payload.get("sessionId")
                            or payload.get("referenceId")
                            or f"fail_{user_id}"
                        )
                        assess_req = AssessRiskRequest(
                            workflow="PAYMENT",
                            entityId=session_id,
                            entityType="PAYMENT_INTENT",
                            userId=user_id,
                            amount=float(payload.get("amount") or 0),
                            metadata={
                                "failureReason": payload.get("error")
                                or payload.get("message"),
                                "failureVelocity": fail_count,
                            },
                        )
                        await fraud_service.assess_risk(assess_req)

            # 4. Seller Payout Risk Pre-Screening
            elif topic == "payout.scheduled":
                payout_id = str(payload.get("payoutId") or payload.get("id") or "")
                seller_id = str(payload.get("sellerId") or "")
                amount = float(payload.get("amount") or 0)
                currency = str(payload.get("currency") or "PKR")
                if payout_id and seller_id:
                    assess_req = AssessRiskRequest(
                        workflow="PAYOUT",
                        entityId=payout_id,
                        entityType="SELLER_PAYOUT",
                        sellerId=seller_id,
                        amount=amount,
                        currency=currency,
                        metadata={
                            "provider": payload.get("provider"),
                            "accountAgeHours": payload.get("accountAgeHours", 72),
                            "holdActive": payload.get("holdActive", False),
                        },
                    )
                    await fraud_service.assess_risk(assess_req)

            # 5. Coupon Redemption Velocity
            elif topic in ("promotion.redeemed", "promotion.reserved"):
                user_id = str(payload.get("userId") or "")
                coupon_code = str(
                    payload.get("couponCode") or payload.get("code") or ""
                )
                if user_id and coupon_code:
                    red_count = await velocity_tracker.record_event(
                        f"coupon_velocity:{user_id}"
                    )
                    if red_count >= 4:
                        assess_req = AssessRiskRequest(
                            workflow="PROMOTION",
                            entityId=f"promo_{user_id}_{coupon_code}",
                            entityType="PROMOTION_RESERVATION",
                            userId=user_id,
                            metadata={
                                "couponCode": coupon_code,
                                "velocity": red_count,
                            },
                        )
                        await fraud_service.assess_risk(assess_req)

            # 6. Return Abuse & High Return Velocity
            elif topic in ("return.requested", "return.created"):
                user_id = str(payload.get("userId") or payload.get("customerId") or "")
                return_id = str(payload.get("returnId") or payload.get("id") or "")
                if user_id and return_id:
                    ret_count = await velocity_tracker.record_event(
                        f"return_velocity:{user_id}"
                    )
                    if ret_count >= 3:
                        assess_req = AssessRiskRequest(
                            workflow="ORDER",
                            entityId=return_id,
                            entityType="RETURN_REQUEST",
                            userId=user_id,
                            amount=float(payload.get("refundAmount") or payload.get("totalRefund") or 0),
                            metadata={"returnVelocity": ret_count},
                        )
                        await fraud_service.assess_risk(assess_req)

            # 7. Rapid Chat Message Flood Detection
            elif topic == "chat.message.created":
                sender_id = str(payload.get("senderId") or "")
                if sender_id and payload.get("senderRole") == "buyer":
                    chat_count = await velocity_tracker.record_event(
                        f"chat_velocity:{sender_id}"
                    )
                    if chat_count >= 20:  # Excessive message flood in 5m
                        assess_req = AssessRiskRequest(
                            workflow="ACCOUNT",
                            entityId=str(payload.get("messageId") or f"chat_{sender_id}"),
                            entityType="CHAT_MESSAGE",
                            userId=sender_id,
                            metadata={
                                "conversationId": str(payload.get("conversationId") or ""),
                                "abuseVelocity": chat_count,
                                "reason": "High frequency chat flood detected",
                            },
                        )
                        await fraud_service.assess_risk(assess_req)

            # 8. Chat Abuse & Harassment Reporting
            elif topic == "chat.message.reported":
                reported_user_id = str(
                    payload.get("reportedUserId") or payload.get("reportedByUserId") or ""
                )
                message_id = str(payload.get("messageId") or "")
                conv_id = str(payload.get("conversationId") or "")
                if reported_user_id and message_id:
                    rep_count = await velocity_tracker.record_event(
                        f"chat_abuse:{reported_user_id}"
                    )
                    assess_req = AssessRiskRequest(
                        workflow="ACCOUNT",
                        entityId=message_id,
                        entityType="CHAT_MESSAGE",
                        userId=reported_user_id,
                        metadata={
                            "conversationId": conv_id,
                            "reason": payload.get("reason"),
                            "abuseVelocity": rep_count,
                        },
                    )
                    await fraud_service.assess_risk(assess_req)

            KAFKA_EVENTS_CONSUMED_TOTAL.labels(topic=topic, status="success").inc()

        except Exception as handler_err:
            KAFKA_EVENTS_FAILED_TOTAL.labels(
                topic=topic, error_type=type(handler_err).__name__
            ).inc()
            logger.warn(
                "Error processing event in fraud consumer handler",
                topic=topic,
                error=str(handler_err),
            )


async def start_kafka_consumer() -> None:
    global _consumer_task, _running
    settings = get_settings()
    if not settings.KAFKA_ENABLED:
        logger.info("Kafka consumer disabled by configuration (KAFKA_ENABLED=false)")
        return

    _running = True

    async def _consume_loop():
        retry_delay = 2
        max_retry_delay = 30
        while _running:
            consumer = None
            try:
                bootstrap_servers = [
                    s.strip()
                    for s in settings.KAFKA_BOOTSTRAP_SERVERS.split(",")
                    if s.strip()
                ]
                consumer = AIOKafkaConsumer(
                    "order.created",
                    "payment.successful",
                    "payment.failed",
                    "payout.scheduled",
                    "promotion.redeemed",
                    "promotion.reserved",
                    "return.requested",
                    "return.created",
                    "chat.message.created",
                    "chat.message.reported",
                    bootstrap_servers=bootstrap_servers,
                    group_id=settings.KAFKA_CONSUMER_GROUP,
                    auto_offset_reset="latest",
                    session_timeout_ms=30000,
                    heartbeat_interval_ms=3000,
                    max_poll_interval_ms=300000,
                    request_timeout_ms=30000,
                    metadata_max_age_ms=5000,
                    retry_backoff_ms=500,
                    value_deserializer=_safe_json_deserialize,
                )
                await consumer.start()
                logger.info("AIOKafkaConsumer connected and subscribed to topics")
                retry_delay = 2

                sem = asyncio.Semaphore(10)  # Bounded worker concurrency pool

                while _running:
                    try:
                        msg_batch = await consumer.getmany(timeout_ms=1000, max_records=20)
                        all_messages = [
                            msg for messages in msg_batch.values() for msg in messages
                        ]
                        if all_messages:
                            tasks = [_process_single_message(m, sem) for m in all_messages]
                            await asyncio.gather(*tasks, return_exceptions=True)
                    except asyncio.CancelledError:
                        return
                    except Exception as e:
                        logger.warn("Transient error in Kafka consumer loop", error=str(e))
                        await asyncio.sleep(1)

            except asyncio.CancelledError:
                return
            except Exception as e:
                logger.warn(
                    f"Could not connect to Kafka consumer; retrying in {retry_delay}s",
                    error=str(e),
                )
                if _running:
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(max_retry_delay, retry_delay * 2)
            finally:
                if consumer:
                    try:
                        await consumer.stop()
                    except Exception:
                        pass

    _consumer_task = asyncio.create_task(_consume_loop())


async def stop_kafka_consumer() -> None:
    global _consumer_task, _running
    _running = False
    if _consumer_task:
        _consumer_task.cancel()
        try:
            await _consumer_task
        except asyncio.CancelledError:
            pass
        _consumer_task = None

