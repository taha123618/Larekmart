"""Initial recommendation schema with pgvector

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-14 20:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import pgvector

revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # 2. Processed events table
    op.create_table(
        "processed_events",
        sa.Column("event_id", sa.String(length=100), primary_key=True),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column(
            "processed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_processed_events_event_type", "processed_events", ["event_type"])

    # 3. User interactions table
    op.create_table(
        "user_interactions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column("user_id", sa.String(length=100), nullable=False),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("event_id", sa.String(length=100), nullable=True, unique=True),
        sa.Column("session_id", sa.String(length=100), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_user_interactions_user_id", "user_interactions", ["user_id"])
    op.create_index("ix_user_interactions_product_id", "user_interactions", ["product_id"])
    op.create_index("ix_user_interactions_event_type", "user_interactions", ["event_type"])
    op.create_index("ix_user_interactions_occurred_at", "user_interactions", ["occurred_at"])
    op.create_index("ix_interactions_user_occurred", "user_interactions", ["user_id", "occurred_at"])
    op.create_index("ix_interactions_prod_occurred", "user_interactions", ["product_id", "occurred_at"])

    # 4. Product embeddings table (Vector 128)
    op.create_table(
        "product_embeddings",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column("product_id", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("embedding", pgvector.sqlalchemy.Vector(128), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("model_version", sa.String(length=50), nullable=False, server_default="v1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_product_embeddings_product_id", "product_embeddings", ["product_id"])

    # 5. User embeddings table (Vector 128)
    op.create_table(
        "user_embeddings",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column("user_id", sa.String(length=100), nullable=False, unique=True),
        sa.Column("embedding", pgvector.sqlalchemy.Vector(128), nullable=False),
        sa.Column("interaction_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("model_version", sa.String(length=50), nullable=False, server_default="v1"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_user_embeddings_user_id", "user_embeddings", ["user_id"])

    # 6. Recommendation models metadata table
    op.create_table(
        "recommendation_models",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("model_type", sa.String(length=50), nullable=False),
        sa.Column("metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("parameters", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_recommendation_models_name", "recommendation_models", ["name"])
    op.create_index("ix_recommendation_models_version", "recommendation_models", ["version"])

    # 7. Recommendation jobs table
    op.create_table(
        "recommendation_jobs",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("job_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
        sa.Column("parameters", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_recommendation_jobs_job_type", "recommendation_jobs", ["job_type"])
    op.create_index("ix_recommendation_jobs_status", "recommendation_jobs", ["status"])

    # 8. Analytics events table
    op.create_table(
        "recommendation_analytics_events",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column("recommendation_id", sa.String(length=100), nullable=True),
        sa.Column("user_id", sa.String(length=100), nullable=False),
        sa.Column("product_id", sa.BigInteger(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("strategy", sa.String(length=50), nullable=False, server_default="unknown"),
        sa.Column("model_version", sa.String(length=50), nullable=False, server_default="v1"),
        sa.Column("position", sa.Integer(), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_analytics_events_user_id", "recommendation_analytics_events", ["user_id"])
    op.create_index("ix_analytics_events_product_id", "recommendation_analytics_events", ["product_id"])
    op.create_index("ix_analytics_events_event_type", "recommendation_analytics_events", ["event_type"])
    op.create_index("ix_analytics_events_strategy", "recommendation_analytics_events", ["strategy"])
    op.create_index("ix_analytics_events_created_at", "recommendation_analytics_events", ["created_at"])


def downgrade() -> None:
    op.drop_table("recommendation_analytics_events")
    op.drop_table("recommendation_jobs")
    op.drop_table("recommendation_models")
    op.drop_table("user_embeddings")
    op.drop_table("product_embeddings")
    op.drop_table("user_interactions")
    op.drop_table("processed_events")
    op.execute("DROP EXTENSION IF EXISTS vector")
