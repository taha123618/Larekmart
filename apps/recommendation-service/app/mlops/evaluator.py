from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class RankingEvaluationReport:
    k: int
    precision_at_k: float
    recall_at_k: float
    ndcg_at_k: float
    catalog_coverage: float
    passed_gate: bool
    gate_reason: str


def compute_ndcg_at_k(recommended: Sequence[str], ground_truth: set[str], k: int) -> float:
    if not ground_truth or k <= 0:
        return 0.0
    dcg = 0.0
    for idx, item in enumerate(recommended[:k]):
        if item in ground_truth:
            dcg += 1.0 / math.log2(idx + 2)
    ideal_hits = min(len(ground_truth), k)
    idcg = sum(1.0 / math.log2(idx + 2) for idx in range(ideal_hits))
    return dcg / idcg if idcg > 0 else 0.0


def evaluate_ranking_quality(
    user_recommendations: dict[str, list[str]],
    user_ground_truth: dict[str, set[str]],
    total_catalog_items: int,
    k: int = 10,
    min_ndcg: float = 0.05,
) -> RankingEvaluationReport:
    """
    Evaluates offline recommendation quality using Precision@K, Recall@K, NDCG@K,
    and Catalog Coverage, enforcing a promotion quality gate.
    """
    users = [u for u in user_ground_truth if user_ground_truth[u]]
    if not users:
        return RankingEvaluationReport(
            k=k,
            precision_at_k=0.0,
            recall_at_k=0.0,
            ndcg_at_k=0.0,
            catalog_coverage=0.0,
            passed_gate=False,
            gate_reason="No ground-truth user interactions available for offline evaluation",
        )

    precisions: list[float] = []
    recalls: list[float] = []
    ndcgs: list[float] = []
    recommended_items_union: set[str] = set()

    for user_id in users:
        recs = user_recommendations.get(user_id, [])[:k]
        truth = user_ground_truth[user_id]
        recommended_items_union.update(recs)

        hits = len(set(recs) & truth)
        precisions.append(hits / max(k, 1))
        recalls.append(hits / max(len(truth), 1))
        ndcgs.append(compute_ndcg_at_k(recs, truth, k))

    avg_precision = round(sum(precisions) / len(users), 4)
    avg_recall = round(sum(recalls) / len(users), 4)
    avg_ndcg = round(sum(ndcgs) / len(users), 4)
    coverage = round(len(recommended_items_union) / max(total_catalog_items, 1), 4)

    passed = avg_ndcg >= min_ndcg
    reason = (
        f"Passed offline quality gate (NDCG@{k}={avg_ndcg} >= {min_ndcg})"
        if passed
        else f"Failed offline quality gate (NDCG@{k}={avg_ndcg} < {min_ndcg})"
    )

    return RankingEvaluationReport(
        k=k,
        precision_at_k=avg_precision,
        recall_at_k=avg_recall,
        ndcg_at_k=avg_ndcg,
        catalog_coverage=coverage,
        passed_gate=passed,
        gate_reason=reason,
    )
