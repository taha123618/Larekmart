from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.repositories.interaction_repository import InteractionRepository
from app.strategies.base import CandidateItem, RecommendationContext, RecommendationStrategy


class TrendingStrategy(RecommendationStrategy):
    name = "trending"

    def __init__(self, interaction_repo: InteractionRepository | AsyncSession) -> None:
        if isinstance(interaction_repo, InteractionRepository):
            self.interaction_repo = interaction_repo
        else:
            self.interaction_repo = InteractionRepository(interaction_repo)
        self.repo = self.interaction_repo
        self.settings = get_settings()

    async def recommend(self, context: RecommendationContext) -> list[CandidateItem]:
        trending_items = await self.interaction_repo.get_trending_products(
            limit=context.limit * 2,
            window_hours=self.settings.TRENDING_WINDOW_HOURS,
            category_slug=context.category_slug,
        )

        candidates: list[CandidateItem] = []
        if not trending_items:
            return candidates

        max_velocity = max((score for _, score in trending_items), default=1.0)
        if max_velocity <= 0:
            max_velocity = 1.0

        for prod_id, raw_score in trending_items:
            if prod_id in context.exclude_product_ids:
                continue

            # Normalize to [0.5, 1.0]
            normalized = 0.5 + 0.5 * (raw_score / max_velocity)
            candidates.append(
                CandidateItem(
                    product_id=prod_id,
                    score=round(normalized, 4),
                    reason="Trending popular item right now",
                    strategy=self.name,
                    category_slug=context.category_slug,
                )
            )
            if len(candidates) >= context.limit:
                break

        return candidates
