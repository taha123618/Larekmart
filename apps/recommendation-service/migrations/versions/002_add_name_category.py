"""Add name and category_slug to product_embeddings

Revision ID: 002_add_name_category
Revises: 001_initial_schema
Create Date: 2026-09-24 23:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002_add_name_category"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("product_embeddings", sa.Column("name", sa.String(length=255), nullable=False, server_default=""))
    op.add_column("product_embeddings", sa.Column("category_slug", sa.String(length=100), nullable=True))
    op.create_index("ix_product_embeddings_category_slug", "product_embeddings", ["category_slug"])


def downgrade() -> None:
    op.drop_index("ix_product_embeddings_category_slug", table_name="product_embeddings")
    op.drop_column("product_embeddings", "category_slug")
    op.drop_column("product_embeddings", "name")
