from app.core.config import get_settings
from app.strategies.base import CandidateItem


class RankingService:
    """
    Dedicated multi-stage ranking component.
    Performs candidate deduplication, business filtering, multi-signal scoring, and top-N selection.
    """

    def __init__(self) -> None:
        self.settings = get_settings()

    def rank(
        self,
        candidates: list[CandidateItem],
        limit: int,
        exclude_product_ids: set[int] | None = None,
    ) -> list[CandidateItem]:
        if not candidates:
            return []

        exclude = exclude_product_ids or set()
        deduped: dict[int, CandidateItem] = {}

        # Deduplicate candidates keeping highest score
        for item in candidates:
            if item.product_id in exclude:
                continue
            if item.product_id not in deduped or item.score > deduped[item.product_id].score:
                deduped[item.product_id] = item

        ranked = list(deduped.values())
        ranked.sort(key=lambda x: x.score, reverse=True)
        return ranked[:limit]

    def blend_scores(
        self,
        collaborative_score: float = 0.0,
        content_score: float = 0.0,
        embedding_score: float = 0.0,
        popularity_score: float = 0.0,
        freshness_score: float = 0.0,
    ) -> float:
        """Computes weighted multi-signal hybrid score."""
        w_collab = self.settings.WEIGHT_COLLABORATIVE
        w_content = self.settings.WEIGHT_CONTENT
        w_emb = self.settings.WEIGHT_EMBEDDING
        w_pop = self.settings.WEIGHT_POPULARITY
        w_fresh = self.settings.WEIGHT_FRESHNESS

        blended = (
            collaborative_score * w_collab
            + content_score * w_content
            + embedding_score * w_emb
            + popularity_score * w_pop
            + freshness_score * w_fresh
        )
        return round(min(1.0, max(0.0, blended)), 4)
