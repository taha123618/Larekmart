from typing import Protocol, runtime_checkable


@runtime_checkable
class EmbeddingProvider(Protocol):
    """Protocol for pluggable embedding models (Scikit-Learn, SentenceTransformers, OpenAI, etc.)."""
    dimension: int

    async def embed(self, text: str) -> list[float]:
        """Generates a dense vector representation for text."""
        ...

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generates embeddings for a batch of texts."""
        ...
