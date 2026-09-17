from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.interaction_repository import InteractionRepository
from app.strategies.base import CandidateItem, RecommendationContext, RecommendationStrategy


class PopularStrategy(RecommendationStrategy):
    name = "popular"

    def __init__(self, interaction_repo: InteractionRepository | AsyncSession) -> None:
        if isinstance(interaction_repo, InteractionRepository):
            self.interaction_repo = interaction_repo
        else:
            self.interaction_repo = InteractionRepository(interaction_repo)
        self.repo = self.interaction_repo

    async def recommend(self, context: RecommendationContext) -> list[CandidateItem]:
        items = await self.interaction_repo.get_popular_products(
            limit=context.limit * 2,
            category_slug=context.category_slug,
        )

        candidates: list[CandidateItem] = []
        if not items:
            return candidates

        max_score = max((score for _, score in items), default=1.0)
        if max_score <= 0:
            max_score = 1.0

        for prod_id, raw_score in items:
            if prod_id in context.exclude_product_ids:
                continue

            normalized = 0.4 + 0.6 * (raw_score / max_score)
            candidates.append(
                CandidateItem(
                    product_id=prod_id,
                    score=round(normalized, 4),
                    reason="Customer favorite best seller",
                    strategy=self.name,
                    category_slug=context.category_slug,
                )
            )
            if len(candidates) >= context.limit:
                break

        return candidates
