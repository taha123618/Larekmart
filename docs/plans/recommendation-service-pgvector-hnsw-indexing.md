# Recommendation Service pgvector HNSW Indexing & Query Optimization

## Overview

`recommendation-service` leverages PostgreSQL with the `pgvector` extension to store product embeddings (`ProductEmbedding`, 128 dimensions) and user embeddings (`UserEmbedding`, 128 dimensions).

### The Bottleneck

In the initial schema migrations (`001_initial_schema.py` and `002_add_name_category.py`), B-Tree indexes were created for scalar columns (`product_id`, `category_slug`, `user_id`), but **NO vector index** was created for the `embedding` columns.

Consequently:

- Every call to `EmbeddingRepository.find_similar_products_by_vector(...)` executes `ProductEmbedding.embedding.cosine_distance(vector)` with `ORDER BY distance LIMIT N`.
- Without an index, PostgreSQL executes an **$O(N)$ full table sequential scan (`Seq Scan`)**, computing 128-dimensional floating-point dot products across all records in the table before sorting.
- At marketplace scale (10,000 to 1,000,000+ products), this creates severe database CPU starvation, high query latency (>500ms), and worker thread exhaustion.

## Target Architecture

### 1. HNSW Vector Indexes via Alembic Migration (`003_add_vector_hnsw_indexes.py`)

- Introduce an HNSW (Hierarchical Navigable Small World) index with cosine distance operator class (`vector_cosine_ops`):
  - `ix_product_embeddings_embedding_hnsw`:
    `CREATE INDEX ix_product_embeddings_embedding_hnsw ON product_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);`
  - `ix_user_embeddings_embedding_hnsw`:
    `CREATE INDEX ix_user_embeddings_embedding_hnsw ON user_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);`
- HNSW indexes provide logarithmic $O(\log N)$ search complexity, delivering sub-millisecond retrieval latency even across millions of vectors.

### 2. Query Optimization & Index Tuning

- Set runtime search accuracy parameter `hnsw.ef_search` (default 40 in session or per-query) to balance search speed with top-k recall.
- Provide fallback and validation tests in `tests/unit/test_vector_similarity.py` and migration tests.
