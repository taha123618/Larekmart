from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


@dataclass
class CandidateItem:
    product_id: int
    score: float
    reason: str
    strategy: str
    category_slug: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class RecommendationContext:
    user_id: str | None = None
    product_id: int | None = None
    category_slug: str | None = None
    limit: int = 20
    exclude_product_ids: set[int] = field(default_factory=set)
    metadata: dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class RecommendationStrategy(Protocol):
    name: str

    async def recommend(self, context: RecommendationContext) -> list[CandidateItem]:
        """Generates a scored list of candidate recommendations for the context."""
        ...
