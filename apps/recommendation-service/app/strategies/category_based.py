from app.repositories.interaction_repository import InteractionRepository
from app.strategies.base import CandidateItem, RecommendationContext, RecommendationStrategy


class CategoryBasedStrategy(RecommendationStrategy):
    name = "category_based"

    def __init__(self, interaction_repo: InteractionRepository) -> None:
        self.interaction_repo = interaction_repo

    async def recommend(self, context: RecommendationContext) -> list[CandidateItem]:
        category = context.category_slug

        # If category not directly provided, check user's top affinity category
        if not category and context.user_id:
            affinities = await self.interaction_repo.get_user_category_affinities(
                user_id=context.user_id,
                limit=1,
            )
            if affinities:
                category = affinities[0][0]

        if not category:
            return []

        items = await self.interaction_repo.get_popular_products(
            limit=context.limit * 2,
            category_slug=category,
        )

        candidates: list[CandidateItem] = []
        max_score = max((score for _, score in items), default=1.0)
        if max_score <= 0:
            max_score = 1.0

        for prod_id, raw_score in items:
            if prod_id in context.exclude_product_ids:
                continue

            normalized = 0.5 + 0.45 * (raw_score / max_score)
            candidates.append(
                CandidateItem(
                    product_id=prod_id,
                    score=round(normalized, 4),
                    reason=f"Top pick in {category.replace('-', ' ').title()}",
                    strategy=self.name,
                    category_slug=category,
                )
            )
            if len(candidates) >= context.limit:
                break

        return candidates
