import time
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.db.models.product_embedding import ProductEmbedding
from app.db.models.user_embedding import UserEmbedding
from app.embeddings.base import EmbeddingProvider
from app.embeddings.provider import get_embedding_provider
from app.observability.metrics import EMBEDDING_GENERATION_DURATION_SECONDS
from app.repositories.embedding_repository import EmbeddingRepository
from app.repositories.interaction_repository import InteractionRepository

logger = get_logger("embedding_service")


class EmbeddingService:
    def __init__(
        self,
        embedding_repo: EmbeddingRepository | None = None,
        interaction_repo: InteractionRepository | None = None,
        session: AsyncSession | None = None,
        provider: EmbeddingProvider | None = None,
    ) -> None:
        if session is not None:
            self.embedding_repo = embedding_repo or EmbeddingRepository(session)
            self.interaction_repo = interaction_repo or InteractionRepository(session)
        else:
            if embedding_repo is None:
                raise ValueError(
                    "Either session or embedding_repo must be provided to EmbeddingService"
                )
            self.embedding_repo = embedding_repo
            self.interaction_repo = interaction_repo

        self.provider = provider or get_embedding_provider()

    @staticmethod
    def build_product_text(
        name: str,
        category_slug: str | None = None,
        description: str | None = None,
        short_description: str | None = None,
        brand: str | None = None,
        tags: list[str] | None = None,
        colors: list[str] | None = None,
        sizes: list[str] | None = None,
    ) -> str:
        parts = [name]
        if brand:
            parts.append(f"Brand: {brand}")
        if category_slug:
            parts.append(f"Category: {category_slug}")
        if short_description:
            parts.append(short_description)
        if description:
            parts.append(description)
        if tags:
            parts.extend(tags)
        if colors:
            parts.append(f"Colors: {' '.join(colors)}")
        if sizes:
            parts.append(f"Sizes: {' '.join(sizes)}")
        return " | ".join(parts)

    async def index_product(
        self,
        product_id: int,
        name: str,
        category: str | None = None,
        category_slug: str | None = None,
        description: str | None = None,
        short_description: str | None = None,
        brand: str | None = None,
        tags: list[str] | None = None,
        colors: list[str] | None = None,
        sizes: list[str] | None = None,
    ) -> ProductEmbedding:
        start = time.perf_counter()
        cat = category_slug or category
        text = self.build_product_text(
            name=name,
            category_slug=cat,
            description=description,
            short_description=short_description,
            brand=brand,
            tags=tags,
            colors=colors,
            sizes=sizes,
        )
        vector = await self.provider.embed(text)
        duration = time.perf_counter() - start
        EMBEDDING_GENERATION_DURATION_SECONDS.labels(provider="hashing").observe(duration)

        saved = await self.embedding_repo.upsert_product_embedding(
            product_id=product_id,
            name=name,
            embedding=vector,
            category_slug=cat,
            metadata={
                "brand": brand,
                "tags": tags or [],
                "colors": colors or [],
                "sizes": sizes or [],
            },
        )
        logger.info(
            "product_embedding_indexed",
            product_id=product_id,
            duration_ms=round(duration * 1000, 2),
        )
        return saved

    async def generate_and_save_product_embedding(
        self,
        product_id: int,
        name: str,
        category_slug: str | None = None,
        description: str | None = None,
        short_description: str | None = None,
        colors: list[str] | None = None,
        sizes: list[str] | None = None,
    ) -> list[float]:
        saved = await self.index_product(
            product_id=product_id,
            name=name,
            category_slug=category_slug,
            description=description,
            short_description=short_description,
            colors=colors,
            sizes=sizes,
        )
        return saved.embedding

    async def build_user_embedding(self, user_id: str) -> UserEmbedding | None:
        """
        Computes a user preference vector by calculating the weighted average of
        product embeddings the user interacted with recently.
        """
        if not self.interaction_repo:
            return None

        interactions = await self.interaction_repo.get_user_interactions(user_id, limit=30)
        if not interactions:
            return None

        vectors: list[np.ndarray] = []
        weights: list[float] = []

        for inter in interactions:
            prod_emb = await self.embedding_repo.get_product_embedding(inter.product_id)
            if prod_emb and prod_emb.embedding:
                vectors.append(np.array(prod_emb.embedding, dtype=np.float32))
                weights.append(max(0.1, inter.weight))

        if not vectors:
            return None

        weighted_sum = np.average(vectors, axis=0, weights=weights)
        norm = np.linalg.norm(weighted_sum)
        if norm > 0:
            weighted_avg = (weighted_sum / norm).tolist()
        else:
            return None

        return await self.embedding_repo.upsert_user_embedding(user_id, weighted_avg)

    async def compute_user_preference_embedding(self, user_id: str) -> list[float] | None:
        user_emb = await self.build_user_embedding(user_id)
        return user_emb.embedding if user_emb else None
