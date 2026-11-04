import asyncio
import json
from aiokafka import AIOKafkaConsumer
from app.core.config import get_settings
from app.core.logging import get_logger
from app.redis.velocity import velocity_tracker
from app.schemas.fraud import AssessRiskRequest
from app.services.fraud_service import fraud_service

logger = get_logger("fraud-service.kafka-consumer")

_consumer_task: asyncio.Task | None = None
_running: bool = False


async def start_kafka_consumer() -> None:
    global _consumer_task, _running
    settings = get_settings()
    if not settings.KAFKA_ENABLED:
        logger.info("Kafka consumer disabled by configuration (KAFKA_ENABLED=false)")
        return

    _running = True

    async def _consume_loop():
        consumer = None
        try:
            consumer = AIOKafkaConsumer(
                "order.created",
                "payment.successful",
                "payment.failed",
                "payout.scheduled",
                "promotion.redeemed",
                "promotion.reserved",
                "return.created",
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(","),
                group_id=settings.KAFKA_CONSUMER_GROUP,
                auto_offset_reset="latest",
                value_deserializer=lambda v: json.loads(v.decode("utf-8")),
            )
            await consumer.start()
            logger.info("AIOKafkaConsumer connected and subscribed to topics")

            while _running:
                try:
                    msg_batch = await consumer.getmany(timeout_ms=1000, max_records=20)
                    for tp, messages in msg_batch.items():
                        for msg in messages:
                            payload = (
                                msg.value.get("value", msg.value)
                                if isinstance(msg.value, dict)
                                else {}
                            )
                            topic = msg.topic

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
                                                entityType="PAYMENT_ATTEMPT",
                                                userId=user_id,
                                                amount=float(payload.get("amount") or 0),
                                                metadata={
                                                    "failureCount": fail_count,
                                                    "reason": payload.get("reason"),
                                                },
                                            )
                                            await fraud_service.assess_risk(assess_req)

                                # 4. Seller Payout Disbursement Risk Assessment
                                elif topic == "payout.scheduled":
                                    seller_id = str(payload.get("sellerId") or "")
                                    payout_id = str(payload.get("payoutId") or payload.get("id") or "")
                                    amount = float(payload.get("amount") or 0)

                                    if seller_id:
                                        await velocity_tracker.record_event(f"payout_seller:{seller_id}")

                                    if payout_id and seller_id:
                                        assess_req = AssessRiskRequest(
                                            workflow="PAYOUT",
                                            entityId=payout_id,
                                            entityType="PAYOUT",
                                            sellerId=seller_id,
                                            amount=amount,
                                            currency=str(payload.get("currency") or "PKR"),
                                            metadata={
                                                "sellerId": seller_id,
                                                "payoutNumber": payload.get("payoutNumber"),
                                            },
                                        )
                                        await fraud_service.assess_risk(assess_req)

                                # 5. Promotion & Coupon Velocity Abuse
                                elif topic in ("promotion.redeemed", "promotion.reserved"):
                                    user_id = str(payload.get("userId") or "")
                                    promo_id = str(payload.get("promotionId") or "")
                                    if user_id:
                                        coupon_count = await velocity_tracker.record_event(
                                            f"coupon:{user_id}"
                                        )
                                        if coupon_count >= 4:
                                            assess_req = AssessRiskRequest(
                                                workflow="PROMOTION",
                                                entityId=str(
                                                    payload.get("redemptionId")
                                                    or payload.get("reservationId")
                                                    or f"coupon_{user_id}"
                                                ),
                                                entityType="PROMOTION_REDEMPTION",
                                                userId=user_id,
                                                metadata={
                                                    "promotionId": promo_id,
                                                    "couponVelocity": coupon_count,
                                                },
                                            )
                                            await fraud_service.assess_risk(assess_req)

                                # 6. Return Abuse & High Return Velocity
                                elif topic == "return.created":
                                    user_id = str(payload.get("userId") or "")
                                    return_id = str(payload.get("returnId") or payload.get("id") or "")
                                    if user_id and return_id:
                                        ret_count = await velocity_tracker.record_event(
                                            f"return:{user_id}"
                                        )
                                        if ret_count >= 3:
                                            assess_req = AssessRiskRequest(
                                                workflow="ORDER",
                                                entityId=return_id,
                                                entityType="RETURN_REQUEST",
                                                userId=user_id,
                                                amount=float(payload.get("refundAmount") or 0),
                                                metadata={"returnVelocity": ret_count},
                                            )
                                            await fraud_service.assess_risk(assess_req)

                            except Exception as handler_err:
                                logger.warn(
                                    "Error processing event in fraud consumer handler",
                                    topic=topic,
                                    error=str(handler_err),
                                )

                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.warn("Transient error in Kafka consumer loop", error=str(e))
                    await asyncio.sleep(2)

        except Exception as e:
            logger.warn(
                "Could not start Kafka consumer; continuing without stream ingestion",
                error=str(e),
            )
        finally:
            if consumer:
                try:
                    await consumer.stop()
                except Exception:
                    pass
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

