from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from app.core.security import verify_admin_role
from app.schemas.fraud import (
    CreateFraudRuleRequest,
    FraudCaseDTO,
    FraudRuleDTO,
    ReviewFraudCaseRequest,
)
from app.services.fraud_service import fraud_service

router = APIRouter(prefix="/api/v1/admin/fraud", tags=["Admin Fraud Management"])


@router.get(
    "/cases",
    response_model=list[FraudCaseDTO],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_admin_role)],
)
async def list_cases(
    status: Optional[str] = Query(None, description="Filter by case status (OPEN, IN_REVIEW, RESOLVED_BLOCKED, RESOLVED_DISMISSED)"),
    priority: Optional[str] = Query(None, description="Filter by priority (LOW, MEDIUM, HIGH, CRITICAL)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Lists fraud cases requiring investigation and human analyst review."""
    return await fraud_service.list_cases(status=status, priority=priority, limit=limit, offset=offset)


@router.post(
    "/cases/{case_id}/review",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_admin_role)],
)
async def review_case(case_id: str, request: ReviewFraudCaseRequest):
    """Submits human analyst resolution (APPROVE, BLOCK, DISMISS) with immutable audit trail."""
    return await fraud_service.review_case(case_id, request)


@router.get(
    "/rules",
    response_model=list[FraudRuleDTO],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_admin_role)],
)
async def list_rules(
    workflow: Optional[str] = Query(None, description="Filter rules by workflow (PAYMENT, ORDER, ACCOUNT, PROMOTION, PAYOUT, SELLER)"),
):
    """Lists configured fraud scoring and evaluation rules."""
    return await fraud_service.list_rules(workflow=workflow)


@router.post(
    "/rules",
    response_model=FraudRuleDTO,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_admin_role)],
)
async def create_rule(request: CreateFraudRuleRequest):
    """Creates a new configurable fraud rule or updates existing rule weights."""
    return await fraud_service.create_rule(request)


@router.patch(
    "/rules/{rule_id}/toggle",
    response_model=FraudRuleDTO,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_admin_role)],
)
async def toggle_rule(rule_id: str, payload: dict):
    """Toggles activation status for a configured fraud rule."""
    is_active = payload.get("isActive", True)
    return await fraud_service.toggle_rule(rule_id, is_active)


@router.get(
    "/metrics",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_admin_role)],
)
async def get_admin_metrics():
    """Returns aggregated fraud metrics for the executive dashboard."""
    return await fraud_service.get_admin_metrics()

