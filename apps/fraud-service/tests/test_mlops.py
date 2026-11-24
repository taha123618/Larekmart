import json
from pathlib import Path

import numpy as np
import pytest
from app.engine.ml_engine import SYNTHETIC_BENIGN_TRAINING_DATA, MLEngine
from app.mlops.drift_detector import FeatureDriftDetector
from app.mlops.registry import ModelRegistryClient
from app.mlops.validator import evaluate_model_quality_gate, validate_training_dataset
from app.schemas.fraud import AssessRiskRequest


def test_dataset_validator_rejects_invalid_shapes_and_bounds():
    assert not validate_training_dataset(np.array([[1.0, 2.0]])).passed
    bad_nan = SYNTHETIC_BENIGN_TRAINING_DATA.copy()
    bad_nan[0, 0] = np.nan
    assert not validate_training_dataset(bad_nan).passed

    bad_negative = SYNTHETIC_BENIGN_TRAINING_DATA.copy()
    bad_negative[0, 0] = -100.0
    assert not validate_training_dataset(bad_negative).passed

    bad_hour = SYNTHETIC_BENIGN_TRAINING_DATA.copy()
    bad_hour[0, 3] = 26.0
    assert not validate_training_dataset(bad_hour).passed

    assert validate_training_dataset(SYNTHETIC_BENIGN_TRAINING_DATA).passed


def test_drift_detector_flags_shifted_distribution():
    detector = FeatureDriftDetector(SYNTHETIC_BENIGN_TRAINING_DATA, window_size=50)
    # Record 20 heavily shifted samples (massive amounts and velocities)
    for _ in range(20):
        detector.record_sample(np.array([500_000.0, 25.0, 5.0, 2.0]))

    reports = {r.feature_name: r for r in detector.compute_drift()}
    assert reports["amount"].psi > 0.25
    assert reports["amount"].status == "HIGH_DRIFT"
    assert reports["velocity"].psi > 0.25


def test_retrain_persists_artifact_and_passes_quality_gate(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ML_ARTIFACT_DIR", str(tmp_path))
    engine = MLEngine()
    engine.registry = ModelRegistryClient(artifact_dir=str(tmp_path))

    result = engine.retrain(model_name="isolation_forest_ci_test", n_estimators=60, contamination=0.05)
    assert result["isActive"] is True
    assert result["metrics"]["separation_margin"] >= 0.02

    manifest_path = Path(result["artifactManifest"]["artifact_path"]).with_suffix(".manifest.json")
    assert manifest_path.exists()
    manifest_data = json.loads(manifest_path.read_text())
    assert len(manifest_data["sha256"]) == 64

    gate = evaluate_model_quality_gate(engine._model, SYNTHETIC_BENIGN_TRAINING_DATA)
    assert gate.passed is True

    # Ensure status endpoint payload includes driftReport
    for _ in range(12):
        engine.predict_anomaly(
            AssessRiskRequest(
                workflow="ORDER",
                entityId="ord_drift_1",
                entityType="order",
                amount=3000.0,
                metadata={"hourOfDay": 14.0, "failedAttemptsCount": 0.0},
            ),
            velocity_count=1,
        )
    status = engine.get_mlops_status()
    assert len(status["driftReport"]) == 4


@pytest.mark.asyncio
async def test_batch_inference_endpoint(async_client, monkeypatch: pytest.MonkeyPatch):
    from app.core.config import get_settings
    from app.schemas.fraud import AssessRiskResponse
    from app.services.fraud_service import fraud_service

    async def mock_assess(req):
        return AssessRiskResponse(
            assessmentId="asmt_batch_1",
            workflow=req.workflow,
            entityId=req.entityId,
            riskScore=10,
            decision="ALLOW",
            triggeredRules=[],
            signals=[],
            createdAt="2026-11-25T00:00:00Z",
        )

    monkeypatch.setattr(fraud_service, "assess_risk", mock_assess)
    payload = [
        {"workflow": "ORDER", "entityId": "ord_b1", "entityType": "order", "amount": 1000.0},
        {"workflow": "PAYMENT", "entityId": "pay_b2", "entityType": "payment", "amount": 2500.0},
    ]
    resp = await async_client.post(
        "/api/v1/internal/fraud/assess/batch",
        json=payload,
        headers={"x-internal-secret": get_settings().INTERNAL_SERVICE_SECRET},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["entityId"] == "ord_b1"
    assert data[1]["entityId"] == "pay_b2"


def test_hyperparameter_tuner_selects_best_margin():
    from app.mlops.tuner import tune_isolation_forest

    result = tune_isolation_forest(
        SYNTHETIC_BENIGN_TRAINING_DATA,
        n_estimators_grid=(25, 50),
        contamination_grid=(0.03, 0.05),
    )
    assert result.trials_evaluated == 4
    assert result.best_margin > 0.0
    assert result.best_params["n_estimators"] in (25, 50)
    assert result.best_params["contamination"] in (0.03, 0.05)
