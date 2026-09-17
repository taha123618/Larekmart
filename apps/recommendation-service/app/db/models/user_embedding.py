import datetime
from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class UserEmbedding(Base):
    __tablename__ = "user_embeddings"

    user_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(128), nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False, default="v1")
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
