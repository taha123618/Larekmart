from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.interaction_repository import InteractionRepository
from app.strategies.base import CandidateItem, RecommendationContext, RecommendationStrategy


class RecentlyViewedStrategy(RecommendationStrategy):
    name = "recently_viewed"

    def __init__(self, interaction_repo: InteractionRepository | AsyncSession) -> None:
        if isinstance(interaction_repo, InteractionRepository):
            self.interaction_repo = interaction_repo
        else:
            self.interaction_repo = InteractionRepository(interaction_repo)
        self.repo = self.interaction_repo

    async def recommend(self, context: RecommendationContext) -> list[CandidateItem]:
        if not context.user_id:
            return []

        recent_ids = await self.interaction_repo.get_recently_viewed_product_ids(
            user_id=context.user_id,
            limit=context.limit,
        )

        candidates: list[CandidateItem] = []
        total = len(recent_ids)
        for idx, prod_id in enumerate(recent_ids):
            if prod_id in context.exclude_product_ids:
                continue

            # Decay score slightly based on recency order
            score = 1.0 - (idx / max(total, 1)) * 0.3
            candidates.append(
                CandidateItem(
                    product_id=prod_id,
                    score=round(score, 4),
                    reason="Recently viewed by you",
                    strategy=self.name,
                )
            )

        return candidates
