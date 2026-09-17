import numpy as np
from sklearn.feature_extraction.text import HashingVectorizer
from app.core.config import get_settings
from app.embeddings.base import EmbeddingProvider


class HashingEmbeddingProvider(EmbeddingProvider):
    """
    High-performance, deterministic text embedding provider using L2-normalized feature hashing.
    Outputs 128-dimensional dense vectors suitable for pgvector indexing and cosine similarity.
    """

    def __init__(self, dimension: int | None = None, dimensions: int | None = None) -> None:
        settings = get_settings()
        self.dimension = dimension or dimensions or settings.EMBEDDING_DIMENSION
        self._vectorizer = HashingVectorizer(
            n_features=self.dimension,
            alternate_sign=False,
            norm="l2",
            lowercase=True,
            token_pattern=r"(?u)\b\w+\b",
        )

    async def embed(self, text: str) -> list[float]:
        if not text or not text.strip():
            # Return zero vector with unit norm fallback
            zero_vec = np.zeros(self.dimension, dtype=np.float32)
            zero_vec[0] = 1.0
            return zero_vec.tolist()

        sparse_vec = self._vectorizer.transform([text])
        dense_vec = sparse_vec.toarray()[0].astype(np.float32)
        norm = np.linalg.norm(dense_vec)
        if norm > 0:
            dense_vec = dense_vec / norm
        else:
            dense_vec[0] = 1.0
        return dense_vec.tolist()

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        cleaned = [t if t and t.strip() else "general item" for t in texts]
        sparse_mat = self._vectorizer.transform(cleaned)
        dense_mat = sparse_mat.toarray().astype(np.float32)
        norms = np.linalg.norm(dense_mat, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        normalized = (dense_mat / norms).tolist()
        return normalized


_default_provider: EmbeddingProvider | None = None


def get_embedding_provider() -> EmbeddingProvider:
    global _default_provider
    if _default_provider is None:
        _default_provider = HashingEmbeddingProvider()
    return _default_provider


ScikitHashingEmbeddingProvider = HashingEmbeddingProvider

