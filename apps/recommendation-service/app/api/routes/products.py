from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_db
from app.repositories.embedding_repository import EmbeddingRepository

router = APIRouter(prefix="/api/v1/products", tags=["Products"])


@router.get("/{product_id}/embedding")
async def get_product_embedding_info(
    product_id: int,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Inspects stored vector embedding and metadata for a product."""
    repo = EmbeddingRepository(session)
    embedding_record = await repo.get_product_embedding(product_id)
    if not embedding_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No embedding found for product ID {product_id}",
        )

    vec = embedding_record.embedding or []
    return {
        "productId": embedding_record.product_id,
        "name": embedding_record.name,
        "categorySlug": embedding_record.category_slug,
        "dimensions": len(vec),
        "embedding": vec,
        "metadata": embedding_record.metadata_,
        "updatedAt": (
            embedding_record.updated_at.isoformat()
            if embedding_record.updated_at
            else None
        ),
    }


@router.get("/{product_id}/neighbors")
async def get_product_vector_neighbors(
    product_id: int,
    limit: int = Query(default=10, ge=1, le=50),
    category_slug: str | None = Query(default=None, alias="categorySlug"),
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Returns nearest product neighbors in pgvector space using cosine distance."""
    repo = EmbeddingRepository(session)
    embedding_record = await repo.get_product_embedding(product_id)
    if not embedding_record or not embedding_record.embedding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No embedding vector found for product ID {product_id}",
        )

    similars = await repo.find_similar_by_vector(
        vector=embedding_record.embedding,
        limit=limit + 1,
        category_slug=category_slug,
    )

    neighbors = [
        {
            "productId": prod.product_id,
            "name": prod.name,
            "categorySlug": prod.category_slug,
            "cosineDistance": round(float(dist), 4),
            "similarityScore": round(max(0.0, 1.0 - float(dist)), 4),
        }
        for prod, dist in similars
        if prod.product_id != product_id
    ]

    return {
        "productId": product_id,
        "neighbors": neighbors[:limit],
    }
