from app.repositories.embedding_repository import EmbeddingRepository
from app.strategies.base import CandidateItem, RecommendationContext, RecommendationStrategy


class EmbeddingStrategy(RecommendationStrategy):
    name = "embedding"

    def __init__(self, embedding_repo: EmbeddingRepository) -> None:
        self.embedding_repo = embedding_repo

    async def recommend(self, context: RecommendationContext) -> list[CandidateItem]:
        candidates: list[CandidateItem] = []

        # User vector similarity
        if context.user_id:
            user_emb = await self.embedding_repo.get_user_embedding(context.user_id)
            if user_emb and user_emb.embedding:
                similar = await self.embedding_repo.find_similar_products_by_vector(
                    vector=user_emb.embedding,
                    limit=context.limit * 2,
                    category_slug=context.category_slug,
                )
                for prod_id, sim in similar:
                    if prod_id in context.exclude_product_ids:
                        continue

                    candidates.append(
                        CandidateItem(
                            product_id=prod_id,
                            score=round(sim, 4),
                            reason="Matches your personal style preferences",
                            strategy=self.name,
                        )
                    )
                    if len(candidates) >= context.limit:
                        break
                return candidates

        # Product vector similarity
        if context.product_id:
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
                        reason="Visually and semantically similar item",
                        strategy=self.name,
                    )
                )
                if len(candidates) >= context.limit:
                    break

        return candidates
