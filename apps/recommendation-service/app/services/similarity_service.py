from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.embedding_repository import EmbeddingRepository
from app.repositories.interaction_repository import InteractionRepository
from app.strategies.base import CandidateItem


class SimilarityService:
    """
    Dedicated product similarity and item-to-item correlation service.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.embedding_repo = EmbeddingRepository(session)
        self.interaction_repo = InteractionRepository(session)

    async def get_similar_products_by_vector(
        self, product_id: int, limit: int = 10
    ) -> list[CandidateItem]:
        neighbors = await self.embedding_repo.find_nearest_neighbors_by_product_id(
            product_id=product_id, limit=limit
        )
        return [
            CandidateItem(
                product_id=p_id,
                score=score,
                reason="Visually and semantically similar style",
                strategy="vector_similarity",
            )
            for p_id, score in neighbors
        ]

    async def get_frequently_bought_together(
        self, product_id: int, limit: int = 5
    ) -> list[CandidateItem]:
        items = await self.interaction_repo.get_frequently_bought_together(
            product_id=product_id, limit=limit
        )
        if not items:
            return []

        max_count = max((count for _, count in items), default=1.0)
        return [
            CandidateItem(
                product_id=p_id,
                score=round(min(1.0, 0.5 + 0.5 * (count / max_count)), 4),
                reason="Frequently purchased together in the same order",
                strategy="frequently_bought_together",
            )
            for p_id, count in items
        ]
