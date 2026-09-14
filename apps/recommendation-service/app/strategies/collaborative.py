from collections import defaultdict
from app.repositories.interaction_repository import InteractionRepository
from app.strategies.base import CandidateItem, RecommendationContext, RecommendationStrategy


class CollaborativeStrategy(RecommendationStrategy):
    name = "collaborative"

    def __init__(self, interaction_repo: InteractionRepository) -> None:
        self.interaction_repo = interaction_repo

    async def recommend(self, context: RecommendationContext) -> list[CandidateItem]:
        candidates: list[CandidateItem] = []

        # 1. Product-context collaborative filtering (Frequently Bought Together / Co-Occurring)
        if context.product_id:
            co_items = await self.interaction_repo.get_frequently_bought_together(
                product_id=context.product_id,
                limit=context.limit * 2,
            )
            if co_items:
                max_co = max((count for _, count in co_items), default=1.0)
                for prod_id, count in co_items:
                    if prod_id in context.exclude_product_ids or prod_id == context.product_id:
                        continue

                    score = 0.5 + 0.48 * (count / max_co)
                    candidates.append(
                        CandidateItem(
                            product_id=prod_id,
                            score=round(score, 4),
                            reason="Frequently bought together with this item",
                            strategy=self.name,
                        )
                    )
                    if len(candidates) >= context.limit:
                        break
            return candidates

        # 2. User-context collaborative filtering (Based on user's recent items)
        if context.user_id:
            recent_ids = await self.interaction_repo.get_recently_viewed_product_ids(
                user_id=context.user_id,
                limit=5,
            )
            if not recent_ids:
                return []

            aggregated_scores: dict[int, float] = defaultdict(float)
            for recent_p in recent_ids:
                co_items = await self.interaction_repo.get_frequently_bought_together(
                    product_id=recent_p,
                    limit=10,
                )
                for prod_id, count in co_items:
                    if prod_id not in context.exclude_product_ids and prod_id not in recent_ids:
                        aggregated_scores[prod_id] += count

            if aggregated_scores:
                max_agg = max(aggregated_scores.values(), default=1.0)
                sorted_items = sorted(aggregated_scores.items(), key=lambda x: x[1], reverse=True)
                for prod_id, agg_count in sorted_items[:context.limit]:
                    score = 0.5 + 0.45 * (agg_count / max_agg)
                    candidates.append(
                        CandidateItem(
                            product_id=prod_id,
                            score=round(score, 4),
                            reason="Customers who viewed items you liked also bought this",
                            strategy=self.name,
                        )
                    )

        return candidates
