from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.product_embedding import ProductEmbedding
from app.db.models.user_embedding import UserEmbedding


class EmbeddingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert_product_embedding(
        self,
        product_id: int,
        name: str,
        embedding: list[float],
        category_slug: str | None = None,
        model_version: str = "v1",
        metadata: dict | None = None,
    ) -> ProductEmbedding:
        stmt = (
            insert(ProductEmbedding)
            .values(
                product_id=product_id,
                name=name,
                embedding=embedding,
                category_slug=category_slug,
                model_version=model_version,
                metadata_=metadata,
            )
            .on_conflict_do_update(
                index_elements=[ProductEmbedding.product_id],
                set_={
                    "name": name,
                    "embedding": embedding,
                    "category_slug": category_slug,
                    "model_version": model_version,
                    "metadata": metadata,
                },
            )
            .returning(ProductEmbedding)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def get_product_embedding(self, product_id: int) -> ProductEmbedding | None:
        stmt = select(ProductEmbedding).where(ProductEmbedding.product_id == product_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def find_similar_products_by_vector(
        self,
        vector: list[float],
        limit: int = 20,
        exclude_product_id: int | None = None,
        category_slug: str | None = None,
    ) -> list[tuple[int, float]]:
        """Finds nearest neighbor products using pgvector cosine distance."""
        # cosine_distance: 0 is identical, 2 is opposite.
        # similarity = 1 - (distance / 2) clamped to [0, 1]
        distance_expr = ProductEmbedding.embedding.cosine_distance(vector)

        stmt = select(
            ProductEmbedding.product_id,
            distance_expr.label("distance"),
        )
        if exclude_product_id:
            stmt = stmt.where(ProductEmbedding.product_id != exclude_product_id)
        if category_slug:
            stmt = stmt.where(ProductEmbedding.category_slug == category_slug)

        stmt = stmt.order_by(distance_expr).limit(limit)
        result = await self.session.execute(stmt)

        items: list[tuple[int, float]] = []
        for row in result.all():
            p_id = row[0]
            dist = float(row[1]) if row[1] is not None else 1.0
            # Convert cosine distance to [0, 1] similarity score
            sim = max(0.0, min(1.0, 1.0 - (dist / 2.0)))
            items.append((p_id, sim))

        return items

    async def find_similar_products_by_id(
        self, product_id: int, limit: int = 20
    ) -> list[tuple[int, float]]:
        prod = await self.get_product_embedding(product_id)
        if not prod:
            return []
        return await self.find_similar_products_by_vector(
            vector=prod.embedding,
            limit=limit,
            exclude_product_id=product_id,
        )

    async def upsert_user_embedding(
        self, user_id: str, embedding: list[float], model_version: str = "v1"
    ) -> UserEmbedding:
        stmt = (
            insert(UserEmbedding)
            .values(
                user_id=user_id,
                embedding=embedding,
                model_version=model_version,
            )
            .on_conflict_do_update(
                index_elements=[UserEmbedding.user_id],
                set_={
                    "embedding": embedding,
                    "model_version": model_version,
                },
            )
            .returning(UserEmbedding)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def get_user_embedding(self, user_id: str) -> UserEmbedding | None:
        stmt = select(UserEmbedding).where(UserEmbedding.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
