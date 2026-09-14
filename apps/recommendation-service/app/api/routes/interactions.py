from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import get_interaction_service
from app.schemas.interaction import InteractionCreate, InteractionResponse
from app.services.interaction_service import InteractionService

router = APIRouter(prefix="/api/v1/interactions", tags=["Interactions"])


@router.post("", response_model=InteractionResponse, status_code=status.HTTP_201_CREATED)
async def create_interaction(
    data: InteractionCreate,
    service: InteractionService = Depends(get_interaction_service),
) -> InteractionResponse:
    """Records a user-product interaction (view, cart, purchase, wishlist)."""
    interaction = await service.record_interaction(data)
    return InteractionResponse.model_validate(interaction)


@router.get("/user/{user_id}", response_model=list[InteractionResponse])
async def get_user_interactions(
    user_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    service: InteractionService = Depends(get_interaction_service),
) -> list[InteractionResponse]:
    """Retrieves interaction history for a given user."""
    interactions = await service.get_user_interactions(user_id=user_id, limit=limit)
    return [InteractionResponse.model_validate(i) for i in interactions]
