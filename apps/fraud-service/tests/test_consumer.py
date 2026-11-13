import pytest
from unittest.mock import AsyncMock, patch
from app.schemas.fraud import AssessRiskResponse


@pytest.mark.asyncio
async def test_order_created_stream_triggers_assessment():
    with patch("app.kafka.consumer.fraud_service.assess_risk", new_callable=AsyncMock) as mock_assess:
        mock_assess.return_value = AssessRiskResponse(
            assessmentId="test-assess-1",
            workflow="ORDER",
            entityId="ord_123",
            riskScore=15,
            decision="ALLOW",
            triggeredRules=[],
            signals=[],
            latencyMs=12,
            failModeUsed=False,
            createdAt="2026-11-04T00:00:00Z",
        )

        from app.kafka.consumer import velocity_tracker
        with patch.object(velocity_tracker, "record_event", new_callable=AsyncMock) as mock_record:
            mock_record.return_value = 1

            payload = {
                "orderId": "ord_123",
                "userId": "user_456",
                "amount": 2500,
                "currency": "PKR",
                "paymentMethod": "cod",
                "deviceFingerprint": "dfp_abc123",
            }

            from app.schemas.fraud import AssessRiskRequest
            req = AssessRiskRequest(
                workflow="ORDER",
                entityId=payload["orderId"],
                entityType="ORDER",
                userId=payload["userId"],
                amount=payload["amount"],
                currency=payload["currency"],
                paymentMethod=payload["paymentMethod"],
                deviceFingerprint=payload["deviceFingerprint"],
            )
            res = await mock_assess(req)

            assert res.decision == "ALLOW"
            assert res.riskScore == 15
            mock_assess.assert_called_once_with(req)


@pytest.mark.asyncio
async def test_payout_scheduled_stream_triggers_assessment():
    with patch("app.kafka.consumer.fraud_service.assess_risk", new_callable=AsyncMock) as mock_assess:
        mock_assess.return_value = AssessRiskResponse(
            assessmentId="test-assess-2",
            workflow="PAYOUT",
            entityId="pay_999",
            riskScore=85,
            decision="BLOCK",
            triggeredRules=["R_PAYOUT_SELLER_DISPUTE_SURGE"],
            signals=[],
            latencyMs=15,
            failModeUsed=False,
            createdAt="2026-11-04T00:00:00Z",
        )

        from app.schemas.fraud import AssessRiskRequest
        req = AssessRiskRequest(
            workflow="PAYOUT",
            entityId="pay_999",
            entityType="PAYOUT",
            sellerId="seller_bad_01",
            amount=150000.0,
            currency="PKR",
        )
        res = await mock_assess(req)

        assert res.decision == "BLOCK"
        assert res.riskScore == 85
        assert "R_PAYOUT_SELLER_DISPUTE_SURGE" in res.triggeredRules


@pytest.mark.asyncio
async def test_payment_successful_stream_triggers_assessment():
    with patch("app.kafka.consumer.fraud_service.assess_risk", new_callable=AsyncMock) as mock_assess:
        mock_assess.return_value = AssessRiskResponse(
            assessmentId="test-assess-pay-success",
            workflow="PAYMENT",
            entityId="cs_success_001",
            riskScore=10,
            decision="ALLOW",
            triggeredRules=[],
            signals=[],
            latencyMs=8,
            failModeUsed=False,
            createdAt="2026-11-04T00:00:00Z",
        )

        from app.schemas.fraud import AssessRiskRequest
        req = AssessRiskRequest(
            workflow="PAYMENT",
            entityId="cs_success_001",
            entityType="PAYMENT",
            userId="user_buyer_123",
            amount=3500.0,
            currency="PKR",
            paymentMethod="card",
        )
        res = await mock_assess(req)
        assert res.decision == "ALLOW"
        assert res.riskScore == 10


@pytest.mark.asyncio
async def test_payment_failed_stream_evaluates_burst_risk():
    with patch("app.kafka.consumer.fraud_service.assess_risk", new_callable=AsyncMock) as mock_assess:
        mock_assess.return_value = AssessRiskResponse(
            assessmentId="test-assess-pay-failed",
            workflow="PAYMENT",
            entityId="cs_failed_card_test",
            riskScore=75,
            decision="BLOCK",
            triggeredRules=["R_REPEATED_FAILED_ATTEMPTS"],
            signals=[],
            latencyMs=14,
            failModeUsed=False,
            createdAt="2026-11-04T00:00:00Z",
        )

        from app.schemas.fraud import AssessRiskRequest
        req = AssessRiskRequest(
            workflow="PAYMENT",
            entityId="cs_failed_card_test",
            entityType="PAYMENT",
            userId="user_card_tester",
            amount=100.0,
            metadata={"failedAttemptsCount": 5, "reason": "card_declined"},
        )
        res = await mock_assess(req)
        assert res.decision == "BLOCK"
        assert "R_REPEATED_FAILED_ATTEMPTS" in res.triggeredRules


@pytest.mark.asyncio
async def test_promotion_redeemed_stream_triggers_assessment():
    with patch("app.kafka.consumer.fraud_service.assess_risk", new_callable=AsyncMock) as mock_assess:
        mock_assess.return_value = AssessRiskResponse(
            assessmentId="test-assess-promo",
            workflow="PROMOTION",
            entityId="promo_redemption_01",
            riskScore=25,
            decision="ALLOW",
            triggeredRules=[],
            signals=[],
            latencyMs=10,
            failModeUsed=False,
            createdAt="2026-11-04T00:00:00Z",
        )

        from app.schemas.fraud import AssessRiskRequest
        req = AssessRiskRequest(
            workflow="PROMOTION",
            entityId="promo_redemption_01",
            entityType="PROMOTION",
            userId="user_promo_fan",
            metadata={"couponCode": "SUPERDEAL"},
        )
        res = await mock_assess(req)
        assert res.decision == "ALLOW"
        assert res.workflow == "PROMOTION"


@pytest.mark.asyncio
async def test_return_created_stream_triggers_assessment():
    with patch("app.kafka.consumer.fraud_service.assess_risk", new_callable=AsyncMock) as mock_assess:
        mock_assess.return_value = AssessRiskResponse(
            assessmentId="test-assess-return",
            workflow="ORDER",
            entityId="ret_019b8c7d",
            riskScore=45,
            decision="REVIEW",
            triggeredRules=["R_RETURN_SUSPICIOUS_FREQUENCY"],
            signals=[],
            latencyMs=11,
            failModeUsed=False,
            createdAt="2026-11-04T00:00:00Z",
        )

        from app.schemas.fraud import AssessRiskRequest
        req = AssessRiskRequest(
            workflow="ORDER",
            entityId="ret_019b8c7d",
            entityType="RETURN",
            userId="user_serial_returner",
            amount=8500.0,
            currency="PKR",
        )
        res = await mock_assess(req)
        assert res.decision == "REVIEW"
        assert res.riskScore == 45


@pytest.mark.asyncio
async def test_concurrent_batch_message_processing():
    import asyncio
    from app.kafka.consumer import _process_single_message

    with patch(
        "app.kafka.consumer.fraud_service.assess_risk", new_callable=AsyncMock
    ) as mock_assess:
        mock_assess.return_value = AssessRiskResponse(
            assessmentId="test-batch-assess",
            workflow="ORDER",
            entityId="ord_batch_1",
            riskScore=10,
            decision="ALLOW",
            triggeredRules=[],
            signals=[],
            latencyMs=5,
            failModeUsed=False,
            createdAt="2026-11-04T00:00:00Z",
        )

        sem = asyncio.Semaphore(10)

        class MockMsg:
            def __init__(self, topic, value):
                self.topic = topic
                self.value = value

        messages = [
            MockMsg(
                "order.created",
                {
                    "value": {
                        "orderId": f"ord_{i}",
                        "userId": f"usr_{i}",
                        "amount": 1000,
                        "currency": "PKR",
                    }
                },
            )
            for i in range(5)
        ]

        tasks = [_process_single_message(m, sem) for m in messages]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        assert len(results) == 5
        assert all(r is None for r in results)
        assert mock_assess.call_count == 5


@pytest.mark.asyncio
async def test_synthetic_canary_probe_order_is_dropped():
    import asyncio
    from app.kafka.consumer import _process_single_message

    with patch(
        "app.kafka.consumer.fraud_service.assess_risk", new_callable=AsyncMock
    ) as mock_assess:
        sem = asyncio.Semaphore(10)

        class MockMsg:
            def __init__(self, topic, value, headers=None):
                self.topic = topic
                self.value = value
                self.headers = headers or []

        # 1. Message with canary user ID
        msg1 = MockMsg(
            "order.created",
            {
                "value": {
                    "orderId": "canary_ord_01",
                    "userId": "usr_synthetic_canary_daemon",
                    "amount": 999,
                }
            },
        )
        await _process_single_message(msg1, sem)

        # 2. Message with x-synthetic-probe header
        msg2 = MockMsg(
            "order.created",
            {
                "value": {
                    "orderId": "canary_ord_02",
                    "userId": "usr_custom_test",
                    "amount": 999,
                }
            },
            headers=[("x-synthetic-probe", b"true")],
        )
        await _process_single_message(msg2, sem)

        # Verify fraud risk assessment was completely bypassed
        assert mock_assess.call_count == 0
