import datetime
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.user_interaction import UserInteraction


class InteractionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, interaction: UserInteraction) -> UserInteraction:
        self.session.add(interaction)
        await self.session.flush()
        return interaction

    async def get_user_interactions(
        self, user_id: str, limit: int = 50
    ) -> list[UserInteraction]:
        stmt = (
            select(UserInteraction)
            .where(UserInteraction.user_id == user_id)
            .order_by(desc(UserInteraction.occurred_at))
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_recently_viewed_product_ids(
        self, user_id: str, limit: int = 20
    ) -> list[int]:
        stmt = (
            select(UserInteraction.product_id)
            .where(UserInteraction.user_id == user_id)
            .group_by(UserInteraction.product_id)
            .order_by(desc(func.max(UserInteraction.occurred_at)))
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_popular_products(
        self, limit: int = 20, category_slug: str | None = None
    ) -> list[tuple[int, float]]:
        """Returns (product_id, aggregated_score) based on interaction weights."""
        query = select(
            UserInteraction.product_id,
            func.sum(UserInteraction.weight).label("total_weight"),
        )
        if category_slug:
            # Check category inside json metadata if available
            query = query.where(
                UserInteraction.metadata_["category_slug"].as_string() == category_slug
            )

        stmt = (
            query.group_by(UserInteraction.product_id)
            .order_by(desc("total_weight"))
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return [(row[0], float(row[1])) for row in result.all()]

    async def get_trending_products(
        self,
        limit: int = 20,
        window_hours: int = 48,
        category_slug: str | None = None,
    ) -> list[tuple[int, float]]:
        """Calculates trending velocity based on interactions within the decay window."""
        cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
            hours=window_hours
        )

        query = (
            select(
                UserInteraction.product_id,
                func.sum(UserInteraction.weight).label("velocity"),
            )
            .where(UserInteraction.occurred_at >= cutoff)
        )

        if category_slug:
            query = query.where(
                UserInteraction.metadata_["category_slug"].as_string() == category_slug
            )

        stmt = (
            query.group_by(UserInteraction.product_id)
            .order_by(desc("velocity"))
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        rows = result.all()
        if rows:
            return [(row[0], float(row[1])) for row in rows]

        # Fallback to general popular if recent window is empty (e.g. cold system)
        return await self.get_popular_products(limit=limit, category_slug=category_slug)

    async def get_frequently_bought_together(
        self, product_id: int, limit: int = 10
    ) -> list[tuple[int, float]]:
        """Finds items co-occurring in the same sessions or orders with product_id."""
        # Find session_ids that contained product_id with ORDER_COMPLETED or ADD_TO_CART
        subquery = (
            select(UserInteraction.session_id)
            .where(
                UserInteraction.product_id == product_id,
                UserInteraction.session_id.isnot(None),
                UserInteraction.event_type.in_(["ORDER_COMPLETED", "ADD_TO_CART"]),
            )
            .distinct()
            .subquery()
        )

        stmt = (
            select(
                UserInteraction.product_id,
                func.count(UserInteraction.id).label("co_occurrence"),
            )
            .where(
                UserInteraction.session_id.in_(select(subquery)),
                UserInteraction.product_id != product_id,
            )
            .group_by(UserInteraction.product_id)
            .order_by(desc("co_occurrence"))
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        rows = result.all()
        return [(row[0], float(row[1])) for row in rows]

    async def get_user_category_affinities(
        self, user_id: str, limit: int = 5
    ) -> list[tuple[str, float]]:
        """Computes categories the user interacts with most."""
        stmt = (
            select(
                UserInteraction.metadata_["category_slug"].as_string().label("cat"),
                func.sum(UserInteraction.weight).label("affinity"),
            )
            .where(
                UserInteraction.user_id == user_id,
                UserInteraction.metadata_["category_slug"].isnot(None),
            )
            .group_by("cat")
            .order_by(desc("affinity"))
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return [(row[0], float(row[1])) for row in result.all() if row[0]]

    async def get_all_user_product_pairs(
        self, min_interactions: int = 1
    ) -> list[tuple[str, int, float]]:
        """Extracts user-item ratings for collaborative filtering."""
        stmt = (
            select(
                UserInteraction.user_id,
                UserInteraction.product_id,
                func.sum(UserInteraction.weight).label("total_weight"),
            )
            .group_by(UserInteraction.user_id, UserInteraction.product_id)
            .having(func.count(UserInteraction.id) >= min_interactions)
        )
        result = await self.session.execute(stmt)
        return [(row[0], row[1], float(row[2])) for row in result.all()]
