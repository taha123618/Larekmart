from collections import defaultdict
from app.core.config import get_settings
from app.strategies.base import CandidateItem, RecommendationContext, RecommendationStrategy
from app.strategies.category_based import CategoryBasedStrategy
from app.strategies.collaborative import CollaborativeStrategy
from app.strategies.content_based import ContentBasedStrategy
from app.strategies.embedding import EmbeddingStrategy
from app.strategies.popular import PopularStrategy
from app.strategies.trending import TrendingStrategy


class HybridStrategy(RecommendationStrategy):
    name = "hybrid"

    def __init__(
        self,
        collaborative_strategy: CollaborativeStrategy,
        content_strategy: ContentBasedStrategy,
        embedding_strategy: EmbeddingStrategy,
        category_strategy: CategoryBasedStrategy,
        trending_strategy: TrendingStrategy,
        popular_strategy: PopularStrategy,
    ) -> None:
        self.collaborative = collaborative_strategy
        self.content = content_strategy
        self.embedding = embedding_strategy
        self.category = category_strategy
        self.trending = trending_strategy
        self.popular = popular_strategy
        self.settings = get_settings()

    async def recommend(self, context: RecommendationContext) -> list[CandidateItem]:
        limit = context.limit
        candidates_by_product: dict[int, CandidateItem] = {}
        strategy_scores: dict[int, dict[str, float]] = defaultdict(dict)

        # 1. Candidate Generation
        collab_items = await self.collaborative.recommend(context)
        for item in collab_items:
            strategy_scores[item.product_id]["collaborative"] = item.score
            candidates_by_product[item.product_id] = item

        emb_items = await self.embedding.recommend(context)
        for item in emb_items:
            strategy_scores[item.product_id]["embedding"] = item.score
            if item.product_id not in candidates_by_product:
                candidates_by_product[item.product_id] = item

        content_items = await self.content.recommend(context)
        for item in content_items:
            strategy_scores[item.product_id]["content"] = item.score
            if item.product_id not in candidates_by_product:
                candidates_by_product[item.product_id] = item

        # Fallback chain 1: Category-based if candidate pool is small
        if len(candidates_by_product) < limit:
            cat_items = await self.category.recommend(context)
            for item in cat_items:
                strategy_scores[item.product_id]["category"] = item.score
                if item.product_id not in candidates_by_product:
                    candidates_by_product[item.product_id] = item

        # Fallback chain 2: Trending if candidate pool still small
        if len(candidates_by_product) < limit:
            trend_items = await self.trending.recommend(context)
            for item in trend_items:
                strategy_scores[item.product_id]["trending"] = item.score
                if item.product_id not in candidates_by_product:
                    candidates_by_product[item.product_id] = item

        # Fallback chain 3: Popular / Global best sellers
        if len(candidates_by_product) < limit:
            pop_items = await self.popular.recommend(context)
            for item in pop_items:
                strategy_scores[item.product_id]["popular"] = item.score
                if item.product_id not in candidates_by_product:
                    candidates_by_product[item.product_id] = item

        # 2. Hybrid Scoring & Blending
        w_collab = self.settings.WEIGHT_COLLABORATIVE
        w_content = self.settings.WEIGHT_CONTENT
        w_emb = self.settings.WEIGHT_EMBEDDING
        w_pop = self.settings.WEIGHT_POPULARITY

        ranked: list[CandidateItem] = []
        for prod_id, item in candidates_by_product.items():
            scores = strategy_scores[prod_id]
            collab_s = scores.get("collaborative", 0.0)
            emb_s = scores.get("embedding", 0.0)
            content_s = scores.get("content", 0.0)
            trend_s = scores.get("trending", 0.0)
            pop_s = scores.get("popular", scores.get("category", 0.0))

            blended_score = (
                collab_s * w_collab
                + emb_s * w_emb
                + content_s * w_content
                + max(trend_s, pop_s) * w_pop
            )

            # Baseline guarantee
            final_score = max(item.score * 0.5, min(1.0, blended_score))
            ranked.append(
                CandidateItem(
                    product_id=prod_id,
                    score=round(final_score, 4),
                    reason=item.reason,
                    strategy=self.name,
                    category_slug=item.category_slug,
                )
            )

        # 3. Sort by score descending and return top N
        ranked.sort(key=lambda c: c.score, reverse=True)
        return ranked[:limit]
