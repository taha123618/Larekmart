"""Add HNSW vector indexes for pgvector similarity search

Revision ID: 003_add_vector_hnsw_indexes
Revises: 002_add_name_category
Create Date: 2026-11-04 17:45:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "003_add_vector_hnsw_indexes"
down_revision: Union[str, None] = "002_add_name_category"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. HNSW index on product_embeddings (cosine distance)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_product_embeddings_embedding_hnsw "
        "ON product_embeddings USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )

    # 2. HNSW index on user_embeddings (cosine distance)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_user_embeddings_embedding_hnsw "
        "ON user_embeddings USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_user_embeddings_embedding_hnsw")
    op.execute("DROP INDEX IF EXISTS ix_product_embeddings_embedding_hnsw")

