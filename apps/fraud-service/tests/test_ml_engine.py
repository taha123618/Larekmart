import pytest
from app.engine.ml_engine import ml_engine
from app.schemas.fraud import AssessRiskRequest


def test_ml_baseline_prediction_normal():
    request = AssessRiskRequest(
        workflow="ORDER",
        entityId="ord_ml_normal",
        entityType="order",
        amount=2500.0,
        metadata={"hourOfDay": 14.0, "failedAttemptsCount": 0.0},
    )
    score_delta, signal = ml_engine.predict_anomaly(request, velocity_count=1)
    assert score_delta == 0
    assert signal is None


def test_ml_anomaly_detection_outlier():
    # Massive anomaly: 10,000,000 amount, 50 velocity, 20 failed attempts at 3 AM
    request = AssessRiskRequest(
        workflow="PAYMENT",
        entityId="ord_ml_outlier",
        entityType="payment",
        amount=10_000_000.0,
        metadata={"hourOfDay": 3.0, "failedAttemptsCount": 20.0},
    )
    score_delta, signal = ml_engine.predict_anomaly(request, velocity_count=50)
    assert score_delta > 0
    assert signal is not None
    assert "behavioral statistical anomaly" in signal.reason

