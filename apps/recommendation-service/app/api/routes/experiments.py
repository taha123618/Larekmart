"""A/B testing & attribution routes for recommendation strategies."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.ab_attribution import ab_experiment_service

router = APIRouter(prefix="/api/v1/recommendations/experiments", tags=["recommendations-ab"])


class CreateExperimentRequest(BaseModel):
    experimentId: str = Field(min_length=1)
    controlStrategy: str = "hybrid_v1"
    variantStrategy: str = "pgvector_rerank_v2"
    trafficSplitPercent: int = Field(default=50, ge=1, le=99)


class RecordAttributionRequest(BaseModel):
    bucket: str
    eventType: str = Field(pattern="^(IMPRESSION|CLICK|CONVERSION)$")
    revenue: float = Field(default=0.0, ge=0.0)


@router.post("")
async def create_experiment(payload: CreateExperimentRequest):
    return ab_experiment_service.create_experiment(
        experiment_id=payload.experimentId,
        control_strategy=payload.controlStrategy,
        variant_strategy=payload.variantStrategy,
        traffic_split_percent=payload.trafficSplitPercent,
    )


@router.get("/{experiment_id}/assign")
async def assign_variant(experiment_id: str, userId: str = "anonymous"):
    return ab_experiment_service.assign_variant(experiment_id, userId)


@router.post("/{experiment_id}/attribution")
async def record_attribution(experiment_id: str, payload: RecordAttributionRequest):
    return ab_experiment_service.record_attribution(
        experiment_id=experiment_id,
        bucket=payload.bucket,
        event_type=payload.eventType,
        revenue=payload.revenue,
    )


@router.get("/{experiment_id}/results")
async def get_experiment_results(experiment_id: str):
    return ab_experiment_service.get_results(experiment_id)
