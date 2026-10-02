from typing import Any
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db
from app.core.security import validate_user_ownership
from app.repositories.embedding_repository import EmbeddingRepository
from app.repositories.interaction_repository import InteractionRepository

router = APIRouter(prefix="/api/v1/users", tags=["Users"])


@router.get("/{user_id}/preferences")
async def get_user_preference_profile(
    user_id: str,
    request: Request,
    limit: int = Query(default=5, ge=1, le=20),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Inspects user preference model, category affinities, and preference vector status."""
    validate_user_ownership(request, user_id)
    inter_repo = InteractionRepository(session)
    emb_repo = EmbeddingRepository(session)

    affinities = await inter_repo.get_user_category_affinities(user_id=user_id, limit=limit)
    user_emb = await emb_repo.get_user_embedding(user_id=user_id)
    recent_interactions = await inter_repo.get_user_interactions(user_id=user_id, limit=10)

    is_cold_start = len(recent_interactions) == 0

    return {
        "userId": user_id,
        "isColdStart": is_cold_start,
        "interactionCount": len(recent_interactions),
        "hasPreferenceVector": bool(user_emb and user_emb.embedding),
        "categoryAffinities": [
            {"categorySlug": cat, "affinityScore": round(score, 4)}
            for cat, score in affinities
        ],
        "recentInteractions": [
            {
                "productId": i.product_id,
                "eventType": i.event_type,
                "weight": i.weight,
                "occurredAt": i.occurred_at.isoformat() if i.occurred_at else None,
            }
            for i in recent_interactions
        ],
    }
