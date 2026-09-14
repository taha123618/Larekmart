from app.repositories.embedding_repository import EmbeddingRepository
from app.strategies.base import CandidateItem, RecommendationContext, RecommendationStrategy


class ContentBasedStrategy(RecommendationStrategy):
    name = "content_based"

    def __init__(self, embedding_repo: EmbeddingRepository) -> None:
        self.embedding_repo = embedding_repo

    async def recommend(self, context: RecommendationContext) -> list[CandidateItem]:
        candidates: list[CandidateItem] = []

        if context.product_id:
            # Match similar content by vector
            similar = await self.embedding_repo.find_similar_products_by_id(
                product_id=context.product_id,
                limit=context.limit * 2,
            )
            for prod_id, sim in similar:
                if prod_id in context.exclude_product_ids:
                    continue

                candidates.append(
                    CandidateItem(
                        product_id=prod_id,
                        score=round(sim, 4),
                        reason="Similar style and attributes to this item",
                        strategy=self.name,
                    )
                )
                if len(candidates) >= context.limit:
                    break

        return candidates
