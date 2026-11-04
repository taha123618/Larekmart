import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(async_client: AsyncClient):
    response = await async_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "fraud-service"
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_metrics_endpoint(async_client: AsyncClient):
    response = await async_client.get("/metrics")
    assert response.status_code == 200
    assert "fraud_assessments_total" in response.text


@pytest.mark.asyncio
async def test_internal_assess_blocks_unauthorized(async_client: AsyncClient):
    payload = {
        "workflow": "PAYMENT",
        "entityId": "pay_test_01",
        "entityType": "payment",
        "amount": 5000.0,
    }
    # No x-internal-secret header
    response = await async_client.post("/api/v1/internal/fraud/assess", json=payload)
    assert response.status_code == 401
    assert "invalid internal service secret" in response.json()["detail"]


@pytest.mark.asyncio
async def test_internal_assess_success_with_secret(async_client: AsyncClient):
    from app.core.config import get_settings
    settings = get_settings()
    payload = {
        "workflow": "PAYMENT",
        "entityId": "pay_test_01",
        "entityType": "payment",
        "amount": 5000.0,
    }
    headers = {"x-internal-secret": settings.INTERNAL_SERVICE_SECRET}
    response = await async_client.post("/api/v1/internal/fraud/assess", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["workflow"] == "PAYMENT"
    assert data["decision"] in ("ALLOW", "REVIEW", "BLOCK")
    assert "riskScore" in data
    assert "latencyMs" in data


@pytest.mark.asyncio
async def test_admin_cases_blocks_unauthorized(async_client: AsyncClient):
    # No admin credentials
    response = await async_client.get("/api/v1/admin/fraud/cases")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_cases_allows_dev_override(async_client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    # Without explicit FRAUD_DEV_AUTH_BYPASS, override is rejected
    headers = {"x-dev-admin-override": "true"}
    res_blocked = await async_client.get("/api/v1/admin/fraud/cases", headers=headers)
    assert res_blocked.status_code == 403

    # With explicit FRAUD_DEV_AUTH_BYPASS in non-production, override is accepted
    monkeypatch.setenv("FRAUD_DEV_AUTH_BYPASS", "true")
    response = await async_client.get("/api/v1/admin/fraud/cases", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_get_assessment_by_id(async_client: AsyncClient):
    from app.core.config import get_settings
    settings = get_settings()
    headers = {"x-internal-secret": settings.INTERNAL_SERVICE_SECRET}

    # 1. Assess transaction
    assess_payload = {
        "workflow": "ORDER",
        "entityId": "ord_query_001",
        "entityType": "order",
        "amount": 4500.0,
    }
    assess_res = await async_client.post("/api/v1/internal/fraud/assess", json=assess_payload, headers=headers)
    assert assess_res.status_code == 200
    assessment_id = assess_res.json()["assessmentId"]

    # 2. Query assessment by id
    get_res = await async_client.get(f"/api/v1/internal/fraud/assessments/{assessment_id}", headers=headers)
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["assessmentId"] == assessment_id
    assert data["workflow"] == "ORDER"
    assert data["entityId"] == "ord_query_001"

    # 3. Non-existent id returns 404
    missing_res = await async_client.get("/api/v1/internal/fraud/assessments/00000000-0000-0000-0000-000000000000", headers=headers)
    assert missing_res.status_code == 404


@pytest.mark.asyncio
async def test_admin_rules_crud_and_metrics(async_client: AsyncClient):
    from app.core.config import get_settings
    settings = get_settings()
    headers = {
        "x-internal-secret": settings.INTERNAL_SERVICE_SECRET,
        "x-user-role": "admin",
        "x-user-id": "admin_test_operator",
    }

    # 1. List rules
    rules_res = await async_client.get("/api/v1/admin/fraud/rules", headers=headers)
    assert rules_res.status_code == 200
    initial_rules = rules_res.json()
    assert isinstance(initial_rules, list)

    # 2. Create custom rule
    new_rule = {
        "ruleCode": "R_CUSTOM_TEST_RULE",
        "name": "Custom Dynamic Test Rule",
        "description": "Rule created during integration testing",
        "workflow": "SELLER",
        "scoreDelta": 30,
        "action": "REVIEW",
        "conditions": {"seller_rating_below": 2.5},
        "failMode": "FAIL_CLOSED",
        "isActive": True,
    }
    create_res = await async_client.post("/api/v1/admin/fraud/rules", json=new_rule, headers=headers)
    assert create_res.status_code == 201
    created_rule = create_res.json()
    assert created_rule["ruleCode"] == "R_CUSTOM_TEST_RULE"
    assert created_rule["scoreDelta"] == 30

    # 3. Toggle rule status
    rule_id = created_rule["id"]
    toggle_res = await async_client.patch(
        f"/api/v1/admin/fraud/rules/{rule_id}/toggle",
        json={"isActive": False},
        headers=headers,
    )
    assert toggle_res.status_code == 200
    assert toggle_res.json()["isActive"] is False

    # 4. Check metrics
    metrics_res = await async_client.get("/api/v1/admin/fraud/metrics", headers=headers)
    assert metrics_res.status_code == 200
    metrics = metrics_res.json()
    assert "totalAssessments" in metrics
    assert "totalCases" in metrics
    assert "openCases" in metrics


@pytest.mark.asyncio
async def test_admin_case_review_lifecycle(async_client: AsyncClient):
    from app.core.config import get_settings
    settings = get_settings()

    # 1. Trigger high-risk assessment creating an OPEN case
    internal_headers = {"x-internal-secret": settings.INTERNAL_SERVICE_SECRET}
    high_risk_payload = {
        "workflow": "PAYMENT",
        "entityId": "pay_suspicious_lifecycle",
        "entityType": "payment",
        "amount": 900_000.0,
        "metadata": {"failedAttemptsCount": 8},
    }
    assess_res = await async_client.post("/api/v1/internal/fraud/assess", json=high_risk_payload, headers=internal_headers)
    assert assess_res.status_code == 200
    case_id = assess_res.json()["caseId"]
    assert case_id is not None

    # 2. Analyst reviews case with APPROVE
    admin_headers = {
        "x-internal-secret": settings.INTERNAL_SERVICE_SECRET,
        "x-user-role": "admin",
        "x-user-id": "analyst_sarah_01",
    }
    review_payload = {
        "decision": "APPROVE",
        "notes": "Customer identity verified via secondary KYC call.",
        "analystId": "analyst_sarah_01",
    }
    review_res = await async_client.post(
        f"/api/v1/admin/fraud/cases/{case_id}/review",
        json=review_payload,
        headers=admin_headers,
    )
    assert review_res.status_code == 200
    review_data = review_res.json()
    assert review_data["status"] == "RESOLVED_DISMISSED"
    assert review_data["decision"] == "APPROVE"


@pytest.mark.asyncio
async def test_security_headers_middleware(async_client: AsyncClient):
    res = await async_client.get("/health")
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert res.headers.get("X-XSS-Protection") == "1; mode=block"
    assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


@pytest.mark.asyncio
async def test_bearer_token_admin_validation(async_client: AsyncClient, monkeypatch: pytest.MonkeyPatch):
    import base64
    import hashlib
    import hmac
    import json
    import time
    from app.core.config import get_settings

    test_hmac_key = "test-hmac-secret-32-chars-long-key!!"
    monkeypatch.setenv("CLERK_JWT_HMAC_KEY", test_hmac_key)

    def make_token(claims: dict, key: str = test_hmac_key, corrupt_sig: bool = False) -> str:
        header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
        payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
        signing_input = f"{header}.{payload}".encode("utf-8")
        if corrupt_sig:
            sig = base64.urlsafe_b64encode(b"invalid_corrupt_signature").decode().rstrip("=")
        else:
            digest = hmac.new(key.encode("utf-8"), signing_input, hashlib.sha256).digest()
            sig = base64.urlsafe_b64encode(digest).decode().rstrip("=")
        return f"{header}.{payload}.{sig}"

    now = time.time()

    # 1. Valid admin token with valid cryptographic signature
    valid_admin_token = make_token({"sub": "admin_user_1", "role": "admin", "exp": now + 3600})
    res_ok = await async_client.get("/api/v1/admin/fraud/cases", headers={"Authorization": f"Bearer {valid_admin_token}"})
    assert res_ok.status_code == 200

    # 2. Forged signature token strictly rejected (401 Unauthorized)
    forged_token = make_token({"sub": "admin_user_1", "role": "admin", "exp": now + 3600}, corrupt_sig=True)
    res_forged = await async_client.get("/api/v1/admin/fraud/cases", headers={"Authorization": f"Bearer {forged_token}"})
    assert res_forged.status_code == 401

    # 3. Non-admin token with valid signature rejected with 403 Forbidden
    user_token = make_token({"sub": "regular_user_1", "role": "user", "exp": now + 3600})
    res_forbidden = await async_client.get("/api/v1/admin/fraud/cases", headers={"Authorization": f"Bearer {user_token}"})
    assert res_forbidden.status_code == 403

    # 4. Expired admin token rejected with 401 Unauthorized
    expired_token = make_token({"sub": "admin_user_1", "role": "admin", "exp": now - 3600})
    res_expired = await async_client.get("/api/v1/admin/fraud/cases", headers={"Authorization": f"Bearer {expired_token}"})
    assert res_expired.status_code == 401

    # 5. Zero-Trust Gateway Header Decoupling: Non-admin user arriving through gateway must be rejected with 403
    settings = get_settings()
    res_gateway_non_admin = await async_client.get(
        "/api/v1/admin/fraud/cases",
        headers={
            "x-internal-secret": settings.INTERNAL_SERVICE_SECRET,
            "x-user-id": "cust_123",
            "x-user-role": "user",
        },
    )
    assert res_gateway_non_admin.status_code == 403

    # 6. Zero-Trust Gateway Header: Admin user arriving through gateway authorized with 200
    res_gateway_admin = await async_client.get(
        "/api/v1/admin/fraud/cases",
        headers={
            "x-internal-secret": settings.INTERNAL_SERVICE_SECRET,
            "x-user-id": "admin_123",
            "x-user-role": "admin",
        },
    )
    assert res_gateway_admin.status_code == 200

    # 7. Production Startup Secret Validation: placeholder secret in production raises ValueError
    from app.core.config import Settings
    with pytest.raises(ValueError, match="Production security violation"):
        Settings(
            APP_ENV="production",
            INTERNAL_SERVICE_SECRET="dev-shared-internal-secret-larekmart",
        )
