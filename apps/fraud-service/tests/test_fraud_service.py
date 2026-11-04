import pytest
from app.schemas.fraud import AssessRiskRequest, CreateFraudRuleRequest, ReviewFraudCaseRequest
from app.services.fraud_service import fraud_service


@pytest.mark.asyncio
async def test_assess_risk_allow_decision():
    request = AssessRiskRequest(
        workflow="ORDER",
        entityId="ord_safe_001",
        entityType="order",
        userId="usr_trusted_001",
        amount=1200.0,
    )
    response = await fraud_service.assess_risk(request)
    assert response.decision == "ALLOW"
    assert response.riskScore < 40
    assert response.caseId is None


@pytest.mark.asyncio
async def test_assess_risk_block_decision_creates_case():
    request = AssessRiskRequest(
        workflow="PAYMENT",
        entityId="pay_fraud_001",
        entityType="payment",
        userId="usr_fraudster_001",
        amount=600_000.0,
        metadata={"failedAttemptsCount": 6},
    )
    response = await fraud_service.assess_risk(request)
    assert response.decision == "BLOCK"
    assert response.riskScore >= 75
    assert response.caseId is not None

    # Check case was registered
    cases = await fraud_service.list_cases(status="OPEN")
    matching = [c for c in cases if c.id == response.caseId]
    assert len(matching) == 1
    assert matching[0].priority == "CRITICAL"


@pytest.mark.asyncio
async def test_case_review_flow():
    # 1. Trigger case
    request = AssessRiskRequest(
        workflow="PAYOUT",
        entityId="pay_hold_001",
        entityType="payout",
        sellerId="seller_review_01",
        amount=250_000.0,
        metadata={"accountModifiedRecently": True},
    )
    response = await fraud_service.assess_risk(request)
    assert response.decision in ("REVIEW", "BLOCK")
    case_id = response.caseId
    assert case_id is not None

    # 2. Analyst reviews and blocks
    review_res = await fraud_service.review_case(
        case_id=case_id,
        request=ReviewFraudCaseRequest(
            decision="BLOCK",
            notes="Confirmed compromised bank account credentials",
            analystId="analyst_sec_01",
        ),
    )
    assert review_res["status"] == "RESOLVED_BLOCKED"
    assert review_res["analystId"] == "analyst_sec_01"


@pytest.mark.asyncio
async def test_create_custom_rule():
    rule_req = CreateFraudRuleRequest(
        ruleCode="R_CUSTOM_IP_BLACKLIST",
        name="Blacklisted IP Range",
        workflow="PAYMENT",
        scoreDelta=80,
        action="BLOCK",
        conditions={"ipPrefix": "198.51.100."},
    )
    rule_dto = await fraud_service.create_rule(rule_req)
    assert rule_dto.ruleCode == "R_CUSTOM_IP_BLACKLIST"
    assert rule_dto.scoreDelta == 80

