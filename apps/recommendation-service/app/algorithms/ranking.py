from dataclasses import dataclass
from typing import Any


@dataclass
class CandidateScore:
    product_id: int
    collaborative_score: float = 0.0
    content_score: float = 0.0
    embedding_score: float = 0.0
    popularity_score: float = 0.0
    freshness_score: float = 0.0
    final_score: float = 0.0
    reason: str = "Recommended for you"
    metadata: dict[str, Any] | None = None


def calculate_composite_rank(
    candidates: list[CandidateScore],
    weights: dict[str, float] | None = None,
    excluded_product_ids: set[int] | None = None,
    limit: int = 20,
) -> list[CandidateScore]:
    """
    Ranks candidate items using weighted multi-objective scoring and applies
    business constraint filters.
    """
    w = weights or {
        "collaborative": 0.35,
        "content": 0.25,
        "embedding": 0.20,
        "popularity": 0.10,
        "freshness": 0.10,
    }
    excluded = excluded_product_ids or set()

    ranked: list[CandidateScore] = []
    seen: set[int] = set()

    for cand in candidates:
        if cand.product_id in excluded or cand.product_id in seen:
            continue

        seen.add(cand.product_id)

        composite = (
            w.get("collaborative", 0.35) * cand.collaborative_score
            + w.get("content", 0.25) * cand.content_score
            + w.get("embedding", 0.20) * cand.embedding_score
            + w.get("popularity", 0.10) * cand.popularity_score
            + w.get("freshness", 0.10) * cand.freshness_score
        )

        cand.final_score = round(min(1.0, max(0.0, composite)), 4)
        ranked.append(cand)

    ranked.sort(key=lambda c: c.final_score, reverse=True)
    return ranked[:limit]
