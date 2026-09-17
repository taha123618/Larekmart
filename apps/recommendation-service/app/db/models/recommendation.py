import datetime
from typing import Any
from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    recommendation_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    strategy: Mapped[str] = mapped_column(String(50), nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), default="v1")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    items: Mapped[list["RecommendationItem"]] = relationship(
        "RecommendationItem",
        back_populates="recommendation",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_recommendations_user_type", "user_id", "recommendation_type"),
    )


class RecommendationItem(Base):
    __tablename__ = "recommendation_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recommendation_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("recommendations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, nullable=True)

    recommendation: Mapped["Recommendation"] = relationship(
        "Recommendation",
        back_populates="items",
    )

    __table_args__ = (
        Index("ix_rec_items_rec_rank", "recommendation_id", "rank"),
    )
