from sqlalchemy.ext.asyncio import AsyncSession

from app.embeddings.provider import ScikitHashingEmbeddingProvider
from app.embeddings.service import EmbeddingService
from app.repositories.interaction_repository import InteractionRepository


class PersonalizationService:
    """
    Dedicated user preference modeling and personalization service.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.interaction_repo = InteractionRepository(session)
        provider = ScikitHashingEmbeddingProvider(dimensions=128)
        self.embedding_service = EmbeddingService(session=session, provider=provider)

    async def get_user_affinities(
        self, user_id: str, limit: int = 5
    ) -> list[tuple[str, float]]:
        """Returns top categories interacted with by user with normalized weights."""
        return await self.interaction_repo.get_user_category_affinities(
            user_id=user_id, limit=limit
        )

    async def update_user_preference_vector(self, user_id: str) -> bool:
        """Aggregates interacted product vectors into a persistent user embedding."""
        user_emb = await self.embedding_service.build_user_embedding(user_id=user_id)
        if user_emb:
            await self.session.commit()
            return True
        return False
