from sqlalchemy.ext.asyncio import AsyncSession

from app.cache.redis import RecommendationCache
from app.core.config import get_settings
from app.repositories.interaction_repository import InteractionRepository


class TrendingService:
    """
    Service responsible for calculating and updating trending products velocity
    with exponential time decay and cache invalidation/warming.
    """

    def __init__(
        self,
        session: AsyncSession,
        cache: RecommendationCache | None = None,
    ) -> None:
        self.session = session
        self.cache = cache
        self.interaction_repo = InteractionRepository(session)
        self.settings = get_settings()

    async def calculate_trending_products(
        self,
        limit: int = 50,
        window_hours: int | None = None,
        category_slug: str | None = None,
    ) -> list[tuple[int, float]]:
        hours = window_hours or self.settings.TRENDING_WINDOW_HOURS
        return await self.interaction_repo.get_trending_products(
            limit=limit,
            window_hours=hours,
            category_slug=category_slug,
        )

    async def warm_trending_cache(self, category_slugs: list[str] | None = None) -> int:
        """Pre-computes and caches global and category trending recommendations in Redis."""
        if not self.cache:
            return 0

        warmed = 0
        global_trending = await self.calculate_trending_products(limit=self.settings.DEFAULT_RECOMMENDATION_LIMIT)
        if global_trending:
            key = self.cache.global_trending_key()
            payload = {
                "items": [
                    {
                        "productId": pid,
                        "score": score,
                        "reason": "Top trending item across platform",
                    }
                    for pid, score in global_trending
                ],
                "metadata": {
                    "strategy": "trending_precomputed",
                    "window_hours": self.settings.TRENDING_WINDOW_HOURS,
                },
            }
            await self.cache.set_json(key, payload, ttl=self.settings.TRENDING_CACHE_TTL)
            warmed += 1

        if category_slugs:
            for cat in category_slugs:
                cat_trending = await self.calculate_trending_products(
                    limit=self.settings.DEFAULT_RECOMMENDATION_LIMIT,
                    category_slug=cat,
                )
                if cat_trending:
                    cat_key = self.cache.category_popular_key(cat)
                    cat_payload = {
                        "items": [
                            {
                                "productId": pid,
                                "score": score,
                                "reason": f"Trending in {cat}",
                            }
                            for pid, score in cat_trending
                        ],
                        "metadata": {
                            "strategy": "category_trending_precomputed",
                            "category": cat,
                        },
                    }
                    await self.cache.set_json(cat_key, cat_payload, ttl=self.settings.TRENDING_CACHE_TTL)
                    warmed += 1

        return warmed
