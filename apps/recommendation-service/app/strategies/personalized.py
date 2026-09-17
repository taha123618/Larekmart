from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.embedding_repository import EmbeddingRepository
from app.repositories.interaction_repository import InteractionRepository
from app.strategies.base import CandidateItem, RecommendationContext, RecommendationStrategy


class PersonalizedStrategy(RecommendationStrategy):
    name = "personalized"

    def __init__(
        self,
        interaction_repo: InteractionRepository | AsyncSession,
        embedding_repo: EmbeddingRepository | AsyncSession,
    ) -> None:
        self.interaction_repo = (
            interaction_repo
            if isinstance(interaction_repo, InteractionRepository)
            else InteractionRepository(interaction_repo)
        )
        self.embedding_repo = (
            embedding_repo
            if isinstance(embedding_repo, EmbeddingRepository)
            else EmbeddingRepository(embedding_repo)
        )

    async def recommend(self, context: RecommendationContext) -> list[CandidateItem]:
        if not context.user_id:
            return []

        candidates: list[CandidateItem] = []
        seen_ids: set[int] = set(context.exclude_product_ids)

        # 1. Try preference vector similarity
        user_emb = await self.embedding_repo.get_user_embedding(context.user_id)
        if user_emb and user_emb.embedding:
            similars = await self.embedding_repo.find_similar_by_vector(
                vector=user_emb.embedding,
                limit=context.limit,
                category_slug=context.category_slug,
            )
            for prod, distance in similars:
                if prod.product_id in seen_ids:
                    continue
                score = round(max(0.0, 1.0 - float(distance)), 4)
                seen_ids.add(prod.product_id)
                candidates.append(
                    CandidateItem(
                        product_id=prod.product_id,
                        score=score,
                        reason="Matches your visual and style preferences",
                        strategy=self.name,
                        category_slug=prod.category_slug,
                    )
                )

        # 2. Complement with category affinity if vector candidates are insufficient
        if len(candidates) < context.limit:
            affinities = await self.interaction_repo.get_user_category_affinities(
                context.user_id, limit=3
            )
            for cat_slug, weight in affinities:
                if context.category_slug and cat_slug != context.category_slug:
                    continue
                popular_in_cat = await self.interaction_repo.get_popular_products(
                    limit=context.limit, category_slug=cat_slug
                )
                for pid, pop_score in popular_in_cat:
                    if pid in seen_ids:
                        continue
                    seen_ids.add(pid)
                    candidates.append(
                        CandidateItem(
                            product_id=pid,
                            score=round(min(1.0, float(weight) * 0.8), 4),
                            reason=f"Popular in your favorite category ({cat_slug})",
                            strategy=self.name,
                            category_slug=cat_slug,
                        )
                    )
                    if len(candidates) >= context.limit:
                        break
                if len(candidates) >= context.limit:
                    break

        return candidates[: context.limit]
