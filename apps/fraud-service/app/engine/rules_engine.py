from typing import Any
from app.core.logging import get_logger
from app.observability.metrics import FRAUD_RULES_TRIGGERED_TOTAL
from app.redis.velocity import velocity_tracker
from app.schemas.fraud import AssessRiskRequest, SignalDetail

logger = get_logger("fraud-service.rules")


class RuleEvaluationResult:
    def __init__(
        self,
        score: int,
        triggered_rules: list[str],
        signals: list[SignalDetail],
        fail_mode_used: bool = False,
    ):
        self.score = min(100, max(0, score))
        self.triggered_rules = triggered_rules
        self.signals = signals
        self.fail_mode_used = fail_mode_used


class RulesEngine:
    """
    Configurable Rule Engine evaluating deterministic and explainable fraud indicators.
    Enforces fail-open or fail-closed behavior per workflow.
    """

    async def evaluate(self, request: AssessRiskRequest) -> RuleEvaluationResult:
        score = 0
        triggered_rules: list[str] = []
        signals: list[SignalDetail] = []
        workflow = request.workflow

        try:
            # 1. Sliding Window Velocity Checks
            if request.userId:
                user_velocity = await velocity_tracker.record_event(f"user:{request.userId}")
                if user_velocity >= 8:
                    triggered_rules.append("R_USER_VELOCITY_CRITICAL")
                    score += 50
                    signals.append(
                        SignalDetail(
                            name="user_velocity_critical",
                            scoreDelta=50,
                            reason=f"High transaction frequency: {user_velocity} requests in window",
                        )
                    )
                    FRAUD_RULES_TRIGGERED_TOTAL.labels(rule_code="R_USER_VELOCITY_CRITICAL", workflow=workflow).inc()
                elif user_velocity >= 4:
                    triggered_rules.append("R_USER_VELOCITY_ELEVATED")
                    score += 25
                    signals.append(
                        SignalDetail(
                            name="user_velocity_elevated",
                            scoreDelta=25,
                            reason=f"Elevated transaction frequency: {user_velocity} requests in window",
                        )
                    )
                    FRAUD_RULES_TRIGGERED_TOTAL.labels(rule_code="R_USER_VELOCITY_ELEVATED", workflow=workflow).inc()

            if request.ipAddress:
                ip_velocity = await velocity_tracker.record_event(f"ip:{request.ipAddress}")
                if ip_velocity >= 10:
                    triggered_rules.append("R_IP_VELOCITY_ABUSE")
                    score += 40
                    signals.append(
                        SignalDetail(
                            name="ip_velocity_abuse",
                            scoreDelta=40,
                            reason=f"Suspicious IP velocity: {ip_velocity} requests from {request.ipAddress}",
                        )
                    )
                    FRAUD_RULES_TRIGGERED_TOTAL.labels(rule_code="R_IP_VELOCITY_ABUSE", workflow=workflow).inc()

            if request.deviceFingerprint:
                dev_velocity = await velocity_tracker.record_event(f"device:{request.deviceFingerprint}")
                if dev_velocity >= 6:
                    triggered_rules.append("R_DEVICE_VELOCITY_SPIKE")
                    score += 35
                    signals.append(
                        SignalDetail(
                            name="device_velocity_spike",
                            scoreDelta=35,
                            reason=f"Device fingerprint used {dev_velocity} times across sessions",
                        )
                    )
                    FRAUD_RULES_TRIGGERED_TOTAL.labels(rule_code="R_DEVICE_VELOCITY_SPIKE", workflow=workflow).inc()

            # 2. Amount Anomaly Rules
            if request.amount is not None:
                if request.amount >= 500_000:
                    triggered_rules.append("R_EXTREME_TRANSACTION_AMOUNT")
                    score += 45
                    signals.append(
                        SignalDetail(
                            name="extreme_transaction_amount",
                            scoreDelta=45,
                            reason=f"Transaction amount {request.amount} {request.currency or 'PKR'} exceeds extreme threshold",
                        )
                    )
                    FRAUD_RULES_TRIGGERED_TOTAL.labels(rule_code="R_EXTREME_TRANSACTION_AMOUNT", workflow=workflow).inc()
                elif request.amount >= 100_000:
                    triggered_rules.append("R_HIGH_TRANSACTION_AMOUNT")
                    score += 20
                    signals.append(
                        SignalDetail(
                            name="high_transaction_amount",
                            scoreDelta=20,
                            reason=f"Transaction amount {request.amount} {request.currency or 'PKR'} exceeds standard threshold",
                        )
                    )
                    FRAUD_RULES_TRIGGERED_TOTAL.labels(rule_code="R_HIGH_TRANSACTION_AMOUNT", workflow=workflow).inc()

            # 3. Promotion Abuse Rules
            if workflow == "PROMOTION":
                promo_code = request.metadata.get("couponCode") or request.entityId
                if request.userId:
                    promo_velocity = await velocity_tracker.record_event(f"promo:{request.userId}:{promo_code}")
                    if promo_velocity >= 3:
                        triggered_rules.append("R_COUPON_VELOCITY_EXHAUSTION")
                        score += 55
                        signals.append(
                            SignalDetail(
                                name="coupon_velocity_exhaustion",
                                scoreDelta=55,
                                reason=f"Coupon {promo_code} applied {promo_velocity} times rapidly by user",
                            )
                        )
                        FRAUD_RULES_TRIGGERED_TOTAL.labels(rule_code="R_COUPON_VELOCITY_EXHAUSTION", workflow=workflow).inc()

            # 4. Payout Specific Rules
            if workflow == "PAYOUT":
                seller_id = request.sellerId or request.entityId
                if request.metadata.get("accountModifiedRecently"):
                    triggered_rules.append("R_PAYOUT_ACCOUNT_RECENTLY_MODIFIED")
                    score += 60
                    signals.append(
                        SignalDetail(
                            name="payout_account_recently_modified",
                            scoreDelta=60,
                            reason="Bank payout destination altered within 24 hours of disbursement",
                        )
                    )
                    FRAUD_RULES_TRIGGERED_TOTAL.labels(rule_code="R_PAYOUT_ACCOUNT_RECENTLY_MODIFIED", workflow=workflow).inc()

                seller_velocity = await velocity_tracker.record_event(f"payout_seller:{seller_id}")
                if seller_velocity >= 5:
                    triggered_rules.append("R_PAYOUT_SELLER_VELOCITY_SPIKE")
                    score += 45
                    signals.append(
                        SignalDetail(
                            name="payout_seller_velocity_spike",
                            scoreDelta=45,
                            reason=f"Seller {seller_id} initiated {seller_velocity} payouts in single window",
                        )
                    )
                    FRAUD_RULES_TRIGGERED_TOTAL.labels(rule_code="R_PAYOUT_SELLER_VELOCITY_SPIKE", workflow=workflow).inc()

            # 5. Failed Attempts / Account Takeover Rules
            failed_attempts = request.metadata.get("failedAttemptsCount", 0)
            if failed_attempts >= 5:
                triggered_rules.append("R_REPEATED_FAILED_ATTEMPTS")
                score += 50
                signals.append(
                    SignalDetail(
                        name="repeated_failed_attempts",
                        scoreDelta=50,
                        reason=f"Detected {failed_attempts} repeated failed attempts before request",
                    )
                )
                FRAUD_RULES_TRIGGERED_TOTAL.labels(rule_code="R_REPEATED_FAILED_ATTEMPTS", workflow=workflow).inc()

            return RuleEvaluationResult(
                score=score,
                triggered_rules=triggered_rules,
                signals=signals,
                fail_mode_used=False,
            )

        except Exception as e:
            logger.error("Error evaluating fraud rules; applying fail-open/closed policy", workflow=workflow, error=str(e))
            # Financial transactions fail-closed; non-financial fail-open
            if workflow in ("PAYMENT", "PAYOUT"):
                return RuleEvaluationResult(
                    score=80,
                    triggered_rules=["R_FAIL_CLOSED_DEGRADATION"],
                    signals=[
                        SignalDetail(
                            name="fail_closed_degradation",
                            scoreDelta=80,
                            reason="Critical rule engine degradation in financial workflow (Fail-Closed to REVIEW/BLOCK)",
                        )
                    ],
                    fail_mode_used=True,
                )
            else:
                return RuleEvaluationResult(
                    score=0,
                    triggered_rules=["R_FAIL_OPEN_DEGRADATION"],
                    signals=[
                        SignalDetail(
                            name="fail_open_degradation",
                            scoreDelta=0,
                            reason="Rule engine degradation in non-financial workflow (Fail-Open to ALLOW)",
                        )
                    ],
                    fail_mode_used=True,
                )


rules_engine = RulesEngine()

