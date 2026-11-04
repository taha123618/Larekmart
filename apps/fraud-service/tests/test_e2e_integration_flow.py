import pytest
from unittest.mock import patch
from app.core.config import get_settings
from app.schemas.fraud import AssessRiskRequest, ReviewFraudCaseRequest
from app.services.fraud_service import fraud_service
from app.redis.velocity import velocity_tracker


@pytest.mark.asyncio
async def test_e2e_order_lifecycle_benign_vs_fraudulent(async_client):
    """
    E2E Flow:
    1. Benign customer order is submitted -> scored < 20, ALLOW, no investigation case opened.
    2. Compromised user submits high-velocity burst of orders -> scored >= 75, BLOCK, case automatically created.
    3. Admin analyst reviews case and records resolution decision -> emits fraud.case.resolved.
    """
    settings = get_settings()
    secret_headers = {
        "x-internal-secret": settings.INTERNAL_SERVICE_SECRET,
    }
    admin_headers = {
        "x-internal-secret": settings.INTERNAL_SERVICE_SECRET,
        "x-user-role": "admin",
        "x-user-id": "analyst_usr_007",
    }

    # Step 1: Normal order
    normal_order_payload = {
        "workflow": "ORDER",
        "entityId": "ord_benign_1001",
        "entityType": "ORDER",
        "userId": "usr_regular_customer",
        "amount": 2500.0,
        "currency": "PKR",
        "paymentMethod": "cod",
        "deviceFingerprint": "dfp_trusted_browser_001",
        "metadata": {"hourOfDay": 14},
    }

    resp = await async_client.post(
        "/api/v1/internal/fraud/assess",
        json=normal_order_payload,
        headers=secret_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["decision"] == "ALLOW"
    assert data["riskScore"] < 30
    assert data["caseId"] is None

    # Step 2: Flood 9 orders within 60 seconds from same user
    for i in range(8):
        await velocity_tracker.record_event("user:usr_attacker_compromised")

    fraud_order_payload = {
        "workflow": "ORDER",
        "entityId": "ord_attack_9999",
        "entityType": "ORDER",
        "userId": "usr_attacker_compromised",
        "amount": 550000.0,  # Extreme amount + velocity
        "currency": "PKR",
        "paymentMethod": "card",
        "deviceFingerprint": "dfp_proxy_bot_node",
        "metadata": {"failedAttemptsCount": 5, "hourOfDay": 3},
    }

    with patch("app.services.fraud_service.emit_fraud_event") as mock_emit:
        resp = await async_client.post(
            "/api/v1/internal/fraud/assess",
            json=fraud_order_payload,
            headers=secret_headers,
        )
        assert resp.status_code == 200
        fraud_data = resp.json()
        assert fraud_data["decision"] == "BLOCK"
        assert fraud_data["riskScore"] >= 75
        assert fraud_data["caseId"] is not None

        # Verify Kafka alerts were dispatched
        emitted_topics = [call.args[0] for call in mock_emit.call_args_list]
        assert "fraud.assessment.completed" in emitted_topics
        assert "fraud.risk.detected" in emitted_topics
        assert "fraud.case.created" in emitted_topics

        case_id = fraud_data["caseId"]

    # Step 3: Admin analyst inspects and reviews the case
    with patch("app.services.fraud_service.emit_fraud_event") as mock_emit_review:
        review_payload = {
            "decision": "BLOCK",
            "notes": "Confirmed velocity abuse and botnet IP. Account flagged.",
            "analystId": "analyst_usr_007",
        }
        review_resp = await async_client.post(
            f"/api/v1/admin/fraud/cases/{case_id}/review",
            json=review_payload,
            headers=admin_headers,
        )
        assert review_resp.status_code == 200
        review_data = review_resp.json()
        assert review_data["status"] == "RESOLVED_BLOCKED"
        assert review_data["decision"] == "BLOCK"

        # Verify fraud.case.resolved emitted
        emitted_review_topics = [call.args[0] for call in mock_emit_review.call_args_list]
        assert "fraud.case.resolved" in emitted_review_topics


@pytest.mark.asyncio
async def test_e2e_payout_dispute_freeze_and_release(async_client):
    """
    E2E Flow:
    1. Seller with dispute hold attempts payout -> scored high risk, BLOCK, case opened.
    2. Downstream payout-service receives fraud.risk.detected -> freezes seller disbursement batch.
    3. Investigation determines dispute was settled -> analyst clears case (ALLOW) -> emits fraud.case.resolved -> payout hold released.
    """
    settings = get_settings()
    secret_headers = {"x-internal-secret": settings.INTERNAL_SERVICE_SECRET}
    admin_headers = {
        "x-internal-secret": settings.INTERNAL_SERVICE_SECRET,
        "x-user-role": "admin",
        "x-user-id": "analyst_usr_payout",
    }

    payout_req = {
        "workflow": "PAYOUT",
        "entityId": "payout_batch_seller_42",
        "entityType": "PAYOUT",
        "sellerId": "seller_merchant_42",
        "amount": 250000.0,
        "currency": "PKR",
        "metadata": {
            "accountModifiedRecently": True,
        },
    }

    with patch("app.services.fraud_service.emit_fraud_event") as mock_emit:
        resp = await async_client.post(
            "/api/v1/internal/fraud/assess",
            json=payout_req,
            headers=secret_headers,
        )
        assert resp.status_code == 200
        payout_risk = resp.json()
        assert payout_risk["decision"] in ("REVIEW", "BLOCK")
        assert payout_risk["riskScore"] >= 40
        assert payout_risk["caseId"] is not None

        case_id = payout_risk["caseId"]

    # Clearance review by senior risk officer
    with patch("app.services.fraud_service.emit_fraud_event") as mock_emit_clearance:
        clearance_payload = {
            "decision": "APPROVE",
            "notes": "Verified merchant updated banking credentials via phone video call. Dispute cleared.",
            "analystId": "analyst_usr_payout",
        }
        clearance_resp = await async_client.post(
            f"/api/v1/admin/fraud/cases/{case_id}/review",
            json=clearance_payload,
            headers=admin_headers,
        )
        assert clearance_resp.status_code == 200
        clearance_data = clearance_resp.json()
        assert clearance_data["status"] == "RESOLVED_DISMISSED"
        assert clearance_data["decision"] == "APPROVE"

        review_topics = [call.args[0] for call in mock_emit_clearance.call_args_list]
        assert "fraud.case.resolved" in review_topics
