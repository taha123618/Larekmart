import datetime
from sqlalchemy import DateTime, Float, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class RecommendationAnalyticsEvent(Base):
    __tablename__ = "recommendation_analytics_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recommendation_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    user_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # IMPRESSION, CLICK, ADD_TO_CART, PURCHASE
    strategy: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False, default="v1")
    position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    timestamp: Mapped[datetime.datetime] = mapped_column(
        "created_at",
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    @property
    def created_at(self) -> datetime.datetime:
        return self.timestamp

    __table_args__ = (
        Index("ix_rec_analytics_strat_event", "strategy", "event_type"),
        Index("ix_rec_analytics_user_product", "user_id", "product_id"),
    )
