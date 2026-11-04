import pytest
from app.engine.rules_engine import rules_engine
from app.schemas.fraud import AssessRiskRequest


@pytest.mark.asyncio
async def test_normal_order_evaluates_to_zero_risk():
    request = AssessRiskRequest(
        workflow="ORDER",
        entityId="ord_101",
        entityType="order",
        userId="usr_normal_01",
        amount=1500.0,
        currency="PKR",
    )
    result = await rules_engine.evaluate(request)
    assert result.score == 0
    assert len(result.triggered_rules) == 0
    assert not result.fail_mode_used


@pytest.mark.asyncio
async def test_extreme_amount_triggers_rule():
    request = AssessRiskRequest(
        workflow="PAYMENT",
        entityId="pay_999",
        entityType="payment",
        userId="usr_wealthy_01",
        amount=650_000.0,
        currency="PKR",
    )
    result = await rules_engine.evaluate(request)
    assert result.score >= 45
    assert "R_EXTREME_TRANSACTION_AMOUNT" in result.triggered_rules


@pytest.mark.asyncio
async def test_payout_account_modification_rule():
    request = AssessRiskRequest(
        workflow="PAYOUT",
        entityId="pay_seller_01",
        entityType="payout",
        sellerId="seller_rogue_01",
        amount=120_000.0,
        currency="PKR",
        metadata={"accountModifiedRecently": True},
    )
    result = await rules_engine.evaluate(request)
    assert "R_PAYOUT_ACCOUNT_RECENTLY_MODIFIED" in result.triggered_rules
    assert result.score >= 60


@pytest.mark.asyncio
async def test_velocity_burst_triggers_critical_rule():
    user_id = "usr_burst_attacker"
    # Fire 8 consecutive transactions
    for i in range(8):
        req = AssessRiskRequest(
            workflow="PAYMENT",
            entityId=f"pay_burst_{i}",
            entityType="payment",
            userId=user_id,
            amount=500.0,
        )
        res = await rules_engine.evaluate(req)

    # The 8th request should trigger critical velocity
    assert "R_USER_VELOCITY_CRITICAL" in res.triggered_rules
    assert res.score >= 50


@pytest.mark.asyncio
async def test_coupon_velocity_exhaustion_rule():
    user_id = "usr_promo_abuser"
    coupon_code = "SAVE50FLASH"
    for i in range(3):
        req = AssessRiskRequest(
            workflow="PROMOTION",
            entityId=f"promo_eval_{i}",
            entityType="promotion",
            userId=user_id,
            metadata={"couponCode": coupon_code},
        )
        res = await rules_engine.evaluate(req)

    assert "R_COUPON_VELOCITY_EXHAUSTION" in res.triggered_rules
    assert res.score >= 55


@pytest.mark.asyncio
async def test_ip_velocity_abuse_rule():
    attacker_ip = "198.51.100.42"
    for i in range(10):
        req = AssessRiskRequest(
            workflow="PAYMENT",
            entityId=f"pay_ip_{i}",
            entityType="payment",
            ipAddress=attacker_ip,
            amount=100.0,
        )
        res = await rules_engine.evaluate(req)

    assert "R_IP_VELOCITY_ABUSE" in res.triggered_rules
    assert res.score >= 40


@pytest.mark.asyncio
async def test_device_fingerprint_velocity_rule():
    fingerprint = "fp_hardware_hash_999"
    for i in range(6):
        req = AssessRiskRequest(
            workflow="ORDER",
            entityId=f"ord_dev_{i}",
            entityType="order",
            deviceFingerprint=fingerprint,
            amount=2000.0,
        )
        res = await rules_engine.evaluate(req)

    assert "R_DEVICE_VELOCITY_SPIKE" in res.triggered_rules
    assert res.score >= 35


@pytest.mark.asyncio
async def test_repeated_failed_attempts_rule():
    req = AssessRiskRequest(
        workflow="ACCOUNT",
        entityId="acc_takeover_target",
        entityType="account",
        metadata={"failedAttemptsCount": 6},
    )
    res = await rules_engine.evaluate(req)
    assert "R_REPEATED_FAILED_ATTEMPTS" in res.triggered_rules
    assert res.score >= 50


@pytest.mark.asyncio
async def test_payout_seller_velocity_spike():
    seller_id = "seller_burst_payouts"
    for i in range(5):
        req = AssessRiskRequest(
            workflow="PAYOUT",
            entityId=f"payout_spike_{i}",
            entityType="payout",
            sellerId=seller_id,
            amount=50000.0,
        )
        res = await rules_engine.evaluate(req)

    assert "R_PAYOUT_SELLER_VELOCITY_SPIKE" in res.triggered_rules
    assert res.score >= 45


@pytest.mark.asyncio
async def test_fail_closed_degradation_on_exception():
    from unittest.mock import patch
    with patch("app.engine.rules_engine.velocity_tracker.record_event", side_effect=RuntimeError("Redis partition unreachable")):
        req = AssessRiskRequest(
            workflow="PAYMENT",
            entityId="pay_fail_closed_test",
            entityType="payment",
            userId="usr_test_fail_closed",
            amount=1000.0,
        )
        res = await rules_engine.evaluate(req)
        assert res.fail_mode_used is True
        assert res.score == 80
        assert "R_FAIL_CLOSED_DEGRADATION" in res.triggered_rules


@pytest.mark.asyncio
async def test_fail_open_degradation_on_exception():
    from unittest.mock import patch
    with patch("app.engine.rules_engine.velocity_tracker.record_event", side_effect=RuntimeError("Redis partition unreachable")):
        req = AssessRiskRequest(
            workflow="PROMOTION",
            entityId="promo_fail_open_test",
            entityType="promotion",
            userId="usr_test_fail_open",
            metadata={"couponCode": "WELCOME10"},
        )
        res = await rules_engine.evaluate(req)
        assert res.fail_mode_used is True
        assert res.score == 0
        assert "R_FAIL_OPEN_DEGRADATION" in res.triggered_rules

