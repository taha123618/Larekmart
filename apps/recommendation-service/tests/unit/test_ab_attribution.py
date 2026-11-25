"""Unit tests for recommendation A/B testing and attribution."""

from app.services.ab_attribution import RecommendationExperimentService


def test_ab_assignment_and_attribution():
    svc = RecommendationExperimentService()
    svc.create_experiment("exp_rec_1", "hybrid_v1", "pgvector_rerank_v2", 50)

    a1 = svc.assign_variant("exp_rec_1", "usr_alpha")
    a2 = svc.assign_variant("exp_rec_1", "usr_alpha")
    assert a1["bucket"] == a2["bucket"]  # deterministic

    svc.record_attribution(experiment_id="exp_rec_1", bucket="VARIANT", event_type="IMPRESSION")
    svc.record_attribution(experiment_id="exp_rec_1", bucket="VARIANT", event_type="CLICK")
    results = svc.record_attribution(
        experiment_id="exp_rec_1",
        bucket="VARIANT",
        event_type="CONVERSION",
        revenue=149.50,
    )
    assert results["variant"]["impressions"] == 1
    assert results["variant"]["ctrPercent"] == 100.0
    assert results["variant"]["cvrPercent"] == 100.0
    assert results["variant"]["attributedRevenue"] == 149.50
