import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache.redis import RedisCache
from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.models.user_interaction import UserInteraction
from app.repositories.interaction_repository import InteractionRepository
from app.schemas.interaction import InteractionCreate

logger = get_logger("interaction_service")


class InteractionService:
    def __init__(self, session: AsyncSession, cache: RedisCache | None = None) -> None:
        self.session = session
        self.repo = InteractionRepository(session)
        self.cache = cache
        self.settings = get_settings()

    def _resolve_weight(self, event_type: str) -> float:
        weights = self.settings.interaction_weights
        return float(weights.get(event_type, 1.0))

    async def record_interaction(
        self, data: InteractionCreate
    ) -> UserInteraction:
        weight = self._resolve_weight(data.event_type)
        occurred = data.occurred_at or datetime.datetime.now(datetime.timezone.utc)

        interaction = UserInteraction(
            user_id=data.user_id,
            product_id=data.product_id,
            event_type=data.event_type,
            weight=weight,
            event_id=data.event_id,
            session_id=data.session_id,
            metadata_=data.metadata,
            occurred_at=occurred,
        )

        saved = await self.repo.add(interaction)
        await self.session.commit()

        # Invalidate user personalized recommendation cache asynchronously
        if self.cache and data.user_id:
            try:
                await self.cache.delete(f"recommendations:user:{data.user_id}:personalized")
                await self.cache.delete(f"recommendations:user:{data.user_id}:recent")
            except Exception as exc:
                logger.warning("failed_to_invalidate_cache", user_id=data.user_id, error=str(exc))

        logger.debug(
            "recorded_interaction",
            user_id=data.user_id,
            product_id=data.product_id,
            event_type=data.event_type,
            weight=weight,
        )
        return saved

    async def get_user_interactions(
        self, user_id: str, limit: int = 50
    ) -> list[UserInteraction]:
        return await self.repo.get_user_interactions(user_id=user_id, limit=limit)
