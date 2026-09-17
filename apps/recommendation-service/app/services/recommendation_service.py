import time
from sqlalchemy.ext.asyncio import AsyncSession
from app.cache.redis import RecommendationCache
from app.core.config import get_settings
from app.core.logging import get_logger
from app.observability.metrics import (
    RECOMMENDATION_GENERATION_ERRORS_TOTAL,
    RECOMMENDATION_GENERATION_TOTAL,
    RECOMMENDATION_REQUEST_DURATION_SECONDS,
)
from app.repositories.embedding_repository import EmbeddingRepository
from app.repositories.interaction_repository import InteractionRepository
from app.schemas.recommendation import (
    HomeRecommendationsResponse,
    RecommendationItem,
    RecommendationMetadata,
    RecommendationResponse,
)
from app.strategies.base import CandidateItem, RecommendationContext
from app.strategies.category_based import CategoryBasedStrategy
from app.strategies.collaborative import CollaborativeStrategy
from app.strategies.content_based import ContentBasedStrategy
from app.strategies.embedding import EmbeddingStrategy
from app.strategies.hybrid import HybridStrategy
from app.strategies.popular import PopularStrategy
from app.strategies.recently_viewed import RecentlyViewedStrategy
from app.strategies.trending import TrendingStrategy

logger = get_logger("recommendation_service")


class RecommendationService:
    def __init__(
        self,
        session: AsyncSession,
        cache: RecommendationCache | None = None,
    ) -> None:
        self.session = session
        self.cache = cache
        self.settings = get_settings()

        self.interaction_repo = InteractionRepository(session)
        self.embedding_repo = EmbeddingRepository(session)

        # Initialize strategies
        self.trending_strat = TrendingStrategy(self.interaction_repo)
        self.popular_strat = PopularStrategy(self.interaction_repo)
        self.recently_viewed_strat = RecentlyViewedStrategy(self.interaction_repo)
        self.category_strat = CategoryBasedStrategy(self.interaction_repo)
        self.collab_strat = CollaborativeStrategy(self.interaction_repo)
        self.content_strat = ContentBasedStrategy(self.embedding_repo)
        self.embedding_strat = EmbeddingStrategy(self.embedding_repo)

        self.hybrid_strat = HybridStrategy(
            collaborative_strategy=self.collab_strat,
            content_strategy=self.content_strat,
            embedding_strategy=self.embedding_strat,
            category_strategy=self.category_strat,
            trending_strategy=self.trending_strat,
            popular_strategy=self.popular_strat,
        )

    def _build_response(
        self,
        candidates: list[CandidateItem],
        rec_type: str,
        user_id: str | None,
        strategy_name: str,
        execution_time_ms: float,
        cached: bool = False,
        fallback_used: bool = False,
    ) -> RecommendationResponse:
        items = [
            RecommendationItem(
                product_id=c.product_id,
                score=c.score,
                reason=c.reason,
                category_slug=c.category_slug,
                metadata=c.metadata,
            )
            for c in candidates
        ]
        metadata = RecommendationMetadata(
            strategy=strategy_name,
            model_version="v1",
            fallback_used=fallback_used,
            cached=cached,
            execution_time_ms=round(execution_time_ms, 2),
        )
        return RecommendationResponse(
            user_id=user_id,
            type=rec_type,
            items=items,
            metadata=metadata,
        )

    async def get_personalized_recommendations(
        self,
        user_id: str,
        limit: int = 20,
        category_slug: str | None = None,
    ) -> RecommendationResponse:
        start = time.perf_counter()
        limit = min(limit, self.settings.MAX_RECOMMENDATION_LIMIT)

        # 1. Check Redis Cache
        cache_key = self.cache.user_personalized_key(user_id) if self.cache else None
        if self.cache and cache_key and not category_slug:
            cached_data = await self.cache.get_json(cache_key, cache_type="personalized")
            if cached_data:
                res = RecommendationResponse.model_validate(cached_data)
                res.metadata.cached = True
                return res

        context = RecommendationContext(
            user_id=user_id,
            limit=limit,
            category_slug=category_slug,
        )

        try:
            candidates = await self.hybrid_strat.recommend(context)
            fallback_used = False

            # If user has no interactions (Cold start user), fallback to Trending / Popular
            if not candidates:
                fallback_used = True
                candidates = await self.trending_strat.recommend(context)
                if not candidates:
                    candidates = await self.popular_strat.recommend(context)

            duration_ms = (time.perf_counter() - start) * 1000
            RECOMMENDATION_REQUEST_DURATION_SECONDS.labels(
                endpoint="personalized", recommendation_type="personalized"
            ).observe(duration_ms / 1000.0)
            RECOMMENDATION_GENERATION_TOTAL.labels(
                strategy="hybrid", fallback_used=str(fallback_used).lower()
            ).inc()

            response = self._build_response(
                candidates=candidates,
                rec_type="personalized",
                user_id=user_id,
                strategy_name="hybrid",
                execution_time_ms=duration_ms,
                fallback_used=fallback_used,
            )

            if self.cache and cache_key and not category_slug and candidates:
                await self.cache.set_json(
                    cache_key, response.model_dump(by_alias=True), ttl=self.settings.RECOMMENDATION_CACHE_TTL
                )

            return response
        except Exception as e:
            RECOMMENDATION_GENERATION_ERRORS_TOTAL.labels(
                strategy="hybrid", error_type=type(e).__name__
            ).inc()
            logger.error("personalized_recommendations_failed", user_id=user_id, error=str(e), exc_info=True)
            # Safe degradation to popular
            fallback_candidates = await self.popular_strat.recommend(context)
            return self._build_response(
                candidates=fallback_candidates,
                rec_type="personalized",
                user_id=user_id,
                strategy_name="popular_fallback",
                execution_time_ms=(time.perf_counter() - start) * 1000,
                fallback_used=True,
            )

    async def get_trending_recommendations(
        self,
        limit: int = 20,
        window_hours: int = 48,
        category_slug: str | None = None,
    ) -> RecommendationResponse:
        start = time.perf_counter()
        limit = min(limit, self.settings.MAX_RECOMMENDATION_LIMIT)

        cache_key = (
            self.cache.category_popular_key(category_slug)
            if self.cache and category_slug
            else (self.cache.global_trending_key() if self.cache else None)
        )
        if self.cache and cache_key:
            cached_data = await self.cache.get_json(cache_key, cache_type="trending")
            if cached_data:
                res = RecommendationResponse.model_validate(cached_data)
                res.metadata.cached = True
                return res

        context = RecommendationContext(limit=limit, category_slug=category_slug)
        candidates = await self.trending_strat.recommend(context)
        if not candidates:
            candidates = await self.popular_strat.recommend(context)

        duration_ms = (time.perf_counter() - start) * 1000
        response = self._build_response(
            candidates=candidates,
            rec_type="trending",
            user_id=None,
            strategy_name="trending",
            execution_time_ms=duration_ms,
        )

        if self.cache and cache_key and candidates:
            await self.cache.set_json(
                cache_key, response.model_dump(by_alias=True), ttl=self.settings.TRENDING_CACHE_TTL
            )
        return response

    async def get_popular_recommendations(
        self,
        limit: int = 20,
        category_slug: str | None = None,
    ) -> RecommendationResponse:
        start = time.perf_counter()
        limit = min(limit, self.settings.MAX_RECOMMENDATION_LIMIT)

        cache_key = (
            self.cache.category_popular_key(category_slug)
            if self.cache and category_slug
            else (self.cache.global_popular_key() if self.cache else None)
        )
        if self.cache and cache_key:
            cached_data = await self.cache.get_json(cache_key, cache_type="popular")
            if cached_data:
                res = RecommendationResponse.model_validate(cached_data)
                res.metadata.cached = True
                return res

        context = RecommendationContext(limit=limit, category_slug=category_slug)
        candidates = await self.popular_strat.recommend(context)

        duration_ms = (time.perf_counter() - start) * 1000
        response = self._build_response(
            candidates=candidates,
            rec_type="popular",
            user_id=None,
            strategy_name="popular",
            execution_time_ms=duration_ms,
        )

        if self.cache and cache_key and candidates:
            await self.cache.set_json(
                cache_key, response.model_dump(by_alias=True), ttl=self.settings.POPULAR_CACHE_TTL
            )
        return response

    async def get_category_recommendations(
        self,
        category_slug: str,
        limit: int = 20,
        user_id: str | None = None,
    ) -> RecommendationResponse:
        start = time.perf_counter()
        limit = min(limit, self.settings.MAX_RECOMMENDATION_LIMIT)

        cache_key = self.cache.category_popular_key(category_slug) if self.cache else None
        if self.cache and cache_key and not user_id:
            cached_data = await self.cache.get_json(cache_key, cache_type="category")
            if cached_data:
                res = RecommendationResponse.model_validate(cached_data)
                res.metadata.cached = True
                return res

        context = RecommendationContext(
            user_id=user_id,
            limit=limit,
            category_slug=category_slug,
        )
        candidates = await self.category_strat.recommend(context)
        fallback_used = False
        if not candidates:
            fallback_used = True
            candidates = await self.trending_strat.recommend(context)
            if not candidates:
                candidates = await self.popular_strat.recommend(context)

        duration_ms = (time.perf_counter() - start) * 1000
        response = self._build_response(
            candidates=candidates,
            rec_type="category",
            user_id=user_id,
            strategy_name="category_based",
            execution_time_ms=duration_ms,
            fallback_used=fallback_used,
        )

        if self.cache and cache_key and candidates and not user_id:
            await self.cache.set_json(
                cache_key, response.model_dump(by_alias=True), ttl=self.settings.POPULAR_CACHE_TTL
            )
        return response

    async def get_similar_products(
        self,
        product_id: int,
        limit: int = 10,
        category_slug: str | None = None,
        brand: str | None = None,
    ) -> RecommendationResponse:
        start = time.perf_counter()
        cache_key = None
        if self.cache:
            base_key = self.cache.product_similar_key(product_id)
            if category_slug:
                base_key = f"{base_key}:{category_slug}"
            if brand:
                base_key = f"{base_key}:{brand}"
            cache_key = base_key

        if self.cache and cache_key:
            cached_data = await self.cache.get_json(cache_key, cache_type="similar")
            if cached_data:
                res = RecommendationResponse.model_validate(cached_data)
                res.metadata.cached = True
                return res

        context = RecommendationContext(
            product_id=product_id,
            limit=limit,
            category_slug=category_slug,
            metadata={"brand": brand} if brand else {},
        )
        candidates = await self.content_strat.recommend(context)
        if not candidates:
            candidates = await self.embedding_strat.recommend(context)
        if not candidates:
            candidates = await self.trending_strat.recommend(context)

        duration_ms = (time.perf_counter() - start) * 1000
        response = self._build_response(
            candidates=candidates,
            rec_type="similar",
            user_id=None,
            strategy_name="content_and_embedding",
            execution_time_ms=duration_ms,
        )

        if self.cache and cache_key and candidates:
            await self.cache.set_json(
                cache_key, response.model_dump(by_alias=True), ttl=self.settings.RECOMMENDATION_CACHE_TTL
            )
        return response

    async def get_product_recommendations(
        self,
        product_id: int,
        limit: int = 10,
        category_slug: str | None = None,
    ) -> RecommendationResponse:
        """Product page recommendations combining similarity, content matching, and fallbacks."""
        return await self.get_similar_products(
            product_id=product_id,
            limit=limit,
            category_slug=category_slug,
        )

    async def get_frequently_bought_together(
        self,
        product_id: int,
        limit: int = 5,
    ) -> RecommendationResponse:
        start = time.perf_counter()
        cache_key = self.cache.product_fbt_key(product_id) if self.cache else None
        if self.cache and cache_key:
            cached_data = await self.cache.get_json(cache_key, cache_type="fbt")
            if cached_data:
                res = RecommendationResponse.model_validate(cached_data)
                res.metadata.cached = True
                return res

        context = RecommendationContext(product_id=product_id, limit=limit)
        candidates = await self.collab_strat.recommend(context)
        if not candidates:
            candidates = await self.content_strat.recommend(context)

        duration_ms = (time.perf_counter() - start) * 1000
        response = self._build_response(
            candidates=candidates,
            rec_type="frequently_bought_together",
            user_id=None,
            strategy_name="co_occurrence",
            execution_time_ms=duration_ms,
        )

        if self.cache and cache_key and candidates:
            await self.cache.set_json(
                cache_key, response.model_dump(by_alias=True), ttl=self.settings.RECOMMENDATION_CACHE_TTL
            )
        return response

    async def get_recently_viewed(
        self,
        user_id: str,
        limit: int = 20,
    ) -> RecommendationResponse:
        start = time.perf_counter()
        context = RecommendationContext(user_id=user_id, limit=limit)
        candidates = await self.recently_viewed_strat.recommend(context)

        duration_ms = (time.perf_counter() - start) * 1000
        return self._build_response(
            candidates=candidates,
            rec_type="recently_viewed",
            user_id=user_id,
            strategy_name="recently_viewed",
            execution_time_ms=duration_ms,
        )

    async def get_home_recommendations(
        self,
        user_id: str | None = None,
        limit: int = 10,
    ) -> HomeRecommendationsResponse:
        trending = await self.get_trending_recommendations(limit=limit)
        popular = await self.get_popular_recommendations(limit=limit)

        personalized: RecommendationResponse | None = None
        recently_viewed: RecommendationResponse | None = None

        if user_id:
            personalized = await self.get_personalized_recommendations(user_id=user_id, limit=limit)
            recently_viewed = await self.get_recently_viewed(user_id=user_id, limit=limit)

        return HomeRecommendationsResponse(
            user_id=user_id,
            trending=trending,
            popular=popular,
            personalized=personalized,
            recently_viewed=recently_viewed,
        )
