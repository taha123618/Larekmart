"""A/B testing & attribution tracking for recommendation strategies."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field


@dataclass
class ExperimentVariantStats:
    impressions: int = 0
    clicks: int = 0
    conversions: int = 0
    attributed_revenue: float = 0.0

    def to_dict(self) -> dict:
        ctr = round((self.clicks / self.impressions) * 100, 2) if self.impressions > 0 else 0.0
        cvr = round((self.conversions / self.clicks) * 100, 2) if self.clicks > 0 else 0.0
        return {
            "impressions": self.impressions,
            "clicks": self.clicks,
            "conversions": self.conversions,
            "ctrPercent": ctr,
            "cvrPercent": cvr,
            "attributedRevenue": round(self.attributed_revenue, 2),
        }


@dataclass
class RecommendationExperiment:
    experiment_id: str
    control_strategy: str
    variant_strategy: str
    traffic_split_percent: int = 50
    stats: dict[str, ExperimentVariantStats] = field(
        default_factory=lambda: {
            "CONTROL": ExperimentVariantStats(),
            "VARIANT": ExperimentVariantStats(),
        }
    )


class RecommendationExperimentService:
    """Deterministic user bucketing and attribution tracking for recommendation A/B tests."""

    def __init__(self) -> None:
        self._experiments: dict[str, RecommendationExperiment] = {}

    def create_experiment(
        self,
        experiment_id: str,
        control_strategy: str = "hybrid_v1",
        variant_strategy: str = "pgvector_rerank_v2",
        traffic_split_percent: int = 50,
    ) -> dict:
        exp = RecommendationExperiment(
            experiment_id=experiment_id,
            control_strategy=control_strategy,
            variant_strategy=variant_strategy,
            traffic_split_percent=max(1, min(99, traffic_split_percent)),
        )
        self._experiments[experiment_id] = exp
        return {
            "experimentId": exp.experiment_id,
            "controlStrategy": exp.control_strategy,
            "variantStrategy": exp.variant_strategy,
            "trafficSplitPercent": exp.traffic_split_percent,
        }

    def assign_variant(self, experiment_id: str, user_id: str) -> dict:
        exp = self._experiments.get(experiment_id)
        if exp is None:
            exp = RecommendationExperiment(
                experiment_id=experiment_id,
                control_strategy="hybrid_v1",
                variant_strategy="pgvector_rerank_v2",
            )
            self._experiments[experiment_id] = exp

        digest = hashlib.sha256(f"{experiment_id}:{user_id}".encode()).hexdigest()
        bucket_num = int(digest[:8], 16) % 100
        bucket = "VARIANT" if bucket_num < exp.traffic_split_percent else "CONTROL"
        strategy = exp.variant_strategy if bucket == "VARIANT" else exp.control_strategy
        return {"experimentId": experiment_id, "bucket": bucket, "strategy": strategy}

    def record_attribution(
        self,
        *,
        experiment_id: str,
        bucket: str,
        event_type: str,
        revenue: float = 0.0,
    ) -> dict:
        exp = self._experiments.get(experiment_id)
        if exp is None:
            self.create_experiment(experiment_id)
            exp = self._experiments[experiment_id]

        key = "VARIANT" if bucket.upper() == "VARIANT" else "CONTROL"
        st = exp.stats[key]
        if event_type == "IMPRESSION":
            st.impressions += 1
        elif event_type == "CLICK":
            st.clicks += 1
        elif event_type == "CONVERSION":
            st.conversions += 1
            st.attributed_revenue += max(0.0, revenue)

        return self.get_results(experiment_id)

    def get_results(self, experiment_id: str) -> dict:
        exp = self._experiments.get(experiment_id)
        if exp is None:
            return {"experimentId": experiment_id, "found": False}
        return {
            "experimentId": exp.experiment_id,
            "controlStrategy": exp.control_strategy,
            "variantStrategy": exp.variant_strategy,
            "control": exp.stats["CONTROL"].to_dict(),
            "variant": exp.stats["VARIANT"].to_dict(),
        }


ab_experiment_service = RecommendationExperimentService()
