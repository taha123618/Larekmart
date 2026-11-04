from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import verify_internal_secret
from app.schemas.fraud import AssessRiskRequest, AssessRiskResponse
from app.services.fraud_service import fraud_service

router = APIRouter(prefix="/api/v1/internal/fraud", tags=["Internal Fraud Assessment"])


@router.post(
    "/assess",
    response_model=AssessRiskResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_internal_secret)],
)
async def assess_risk(request: AssessRiskRequest) -> AssessRiskResponse:
    """
    Synchronous risk assessment for payment, order, account, promotion, or payout workflows.
    Evaluates sliding-window velocity, explainable rules, and scikit-learn anomaly scoring.
    """
    return await fraud_service.assess_risk(request)


@router.get(
    "/assessments/{assessment_id}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(verify_internal_secret)],
)
async def get_assessment(assessment_id: str):
    """Retrieves full assessment record and audit trail."""
    record = await fraud_service.get_assessment(assessment_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Risk assessment {assessment_id} not found",
        )
    return record

