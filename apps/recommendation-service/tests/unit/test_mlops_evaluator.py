from pathlib import Path

from app.mlops.evaluator import compute_ndcg_at_k, evaluate_ranking_quality
from app.mlops.registry import RecommendationRegistryClient


def test_compute_ndcg_at_k_exact_order():
    score = compute_ndcg_at_k(["p1", "p2", "p3"], {"p1", "p2"}, k=3)
    assert score == 1.0

    zero_score = compute_ndcg_at_k(["p9", "p8"], {"p1"}, k=2)
    assert zero_score == 0.0


def test_evaluate_ranking_quality_pass_and_fail():
    recs = {"u1": ["p1", "p2", "p3"], "u2": ["p4", "p5", "p6"]}
    truth = {"u1": {"p1"}, "u2": {"p5"}}

    report = evaluate_ranking_quality(recs, truth, total_catalog_items=10, k=3, min_ndcg=0.2)
    assert report.passed_gate is True
    assert report.precision_at_k > 0.0
    assert report.recall_at_k == 1.0
    assert report.catalog_coverage == 0.6

    failing_report = evaluate_ranking_quality(
        {"u1": ["p9", "p8"]},
        {"u1": {"p1"}},
        total_catalog_items=10,
        k=2,
        min_ndcg=0.1,
    )
    assert failing_report.passed_gate is False


def test_recommendation_registry_persists_manifest(tmp_path: Path):
    client = RecommendationRegistryClient(artifact_dir=str(tmp_path))
    manifest = client.register_run(
        model_name="collaborative_item_knn",
        version="v1000",
        parameters={"algorithm": "item_based_cosine"},
        metrics={"ndcg_at_10": 0.42},
    )
    assert Path(manifest["manifest_path"]).exists()
    assert manifest["metrics"]["ndcg_at_10"] == 0.42


async def test_recommendation_mlops_status_endpoint():
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/recommendations/mlops/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["service"] == "recommendation-service"
    assert "mlflowTrackingEnabled" in body
