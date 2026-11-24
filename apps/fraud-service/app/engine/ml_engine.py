import time
import uuid
from datetime import datetime, timezone
from typing import Any
import numpy as np
from sklearn.ensemble import IsolationForest
from app.core.logging import get_logger
from app.mlops import (
    FeatureDriftDetector,
    ModelRegistryClient,
    evaluate_model_quality_gate,
    validate_training_dataset,
)
from app.observability.metrics import (
    ML_FEATURE_DRIFT_PSI,
    ML_INFERENCE_LATENCY_SECONDS,
    ML_MODEL_EVALUATION_MARGIN,
    ML_MODEL_TRAINING_RUNS_TOTAL,
)
from app.schemas.fraud import AssessRiskRequest, SignalDetail

logger = get_logger("fraud-service.ml")

SYNTHETIC_BENIGN_TRAINING_DATA = np.array([
    [1000.0, 1.0, 0.0, 12.0],
    [2500.0, 2.0, 0.0, 14.0],
    [5000.0, 1.0, 0.0, 18.0],
    [15000.0, 3.0, 0.0, 20.0],
    [500.0, 1.0, 0.0, 9.0],
    [8000.0, 2.0, 0.0, 16.0],
    [20000.0, 4.0, 0.0, 21.0],
    [3000.0, 1.0, 0.0, 11.0],
    [1200.0, 1.0, 0.0, 13.0],
    [4500.0, 2.0, 0.0, 15.0],
    [9500.0, 1.0, 0.0, 17.0],
    [22000.0, 3.0, 0.0, 19.0],
])


class MLEngine:
    """
    scikit-learn Anomaly Detection Engine.
    Employs an IsolationForest model to calculate statistical multidimensional anomaly scores.
    Augments the deterministic rule engine without black-box overriding.
    """

    def __init__(self):
        self.model_id = str(uuid.uuid4())
        self.model_name = "isolation_forest_baseline"
        self.algorithm = "IsolationForest"
        self.hyperparameters = {"n_estimators": 50, "contamination": 0.05, "random_state": 42}
        self.metrics = {"training_samples": len(SYNTHETIC_BENIGN_TRAINING_DATA), "status": "TRAINED"}
        self.trained_at = datetime.now(timezone.utc).isoformat()

        self._model = IsolationForest(
            n_estimators=self.hyperparameters["n_estimators"],
            contamination=self.hyperparameters["contamination"],
            random_state=42,
        )
        self._model.fit(SYNTHETIC_BENIGN_TRAINING_DATA)
        self.drift_detector = FeatureDriftDetector(SYNTHETIC_BENIGN_TRAINING_DATA)
        self.registry = ModelRegistryClient()
        self.last_artifact_manifest: dict[str, Any] | None = None
        self.is_ready = True

    def retrain(
        self,
        model_name: str = "isolation_forest_v1",
        n_estimators: int = 50,
        contamination: float = 0.05,
        extra_samples: np.ndarray | None = None,
    ) -> dict[str, Any]:
        """
        Validates training data, retrains IsolationForest, enforces quality gate,
        persists & registers artifact, and refreshes baseline drift distribution.
        """
        training_data = SYNTHETIC_BENIGN_TRAINING_DATA
        if extra_samples is not None and len(extra_samples) > 0:
            training_data = np.vstack([training_data, extra_samples])

        data_check = validate_training_dataset(training_data)
        if not data_check.passed:
            ML_MODEL_TRAINING_RUNS_TOTAL.labels(service="fraud-service", status="dataset_rejected").inc()
            raise ValueError(data_check.reason)

        new_model = IsolationForest(
            n_estimators=n_estimators,
            contamination=contamination,
            random_state=42,
        )
        new_model.fit(training_data)

        gate = evaluate_model_quality_gate(new_model, training_data)
        if not gate.passed:
            ML_MODEL_TRAINING_RUNS_TOTAL.labels(service="fraud-service", status="gate_rejected").inc()
            raise ValueError(gate.reason)

        # Compute model metrics on baseline
        scores = new_model.score_samples(training_data)
        predictions = new_model.predict(training_data)
        anomalies_detected = int(np.sum(predictions == -1))

        self._model = new_model
        self.model_id = str(uuid.uuid4())
        self.model_name = model_name
        self.hyperparameters = {
            "n_estimators": n_estimators,
            "contamination": contamination,
            "random_state": 42,
        }
        self.metrics = {
            "training_samples": len(training_data),
            "baseline_anomalies_detected": anomalies_detected,
            "mean_anomaly_score": float(np.mean(scores)),
            "separation_margin": gate.separation_margin,
            "status": "TRAINED",
        }
        self.trained_at = datetime.now(timezone.utc).isoformat()
        self.drift_detector.fit_baseline(training_data)
        self.last_artifact_manifest = self.registry.save_and_register(
            model=new_model,
            model_id=self.model_id,
            model_name=self.model_name,
            hyperparameters=self.hyperparameters,
            metrics=self.metrics,
        )

        ML_MODEL_TRAINING_RUNS_TOTAL.labels(service="fraud-service", status="promoted").inc()
        ML_MODEL_EVALUATION_MARGIN.labels(service="fraud-service", model_name=self.model_name).set(
            gate.separation_margin
        )
        logger.info(
            "Fraud ML model successfully retrained and promoted",
            model_id=self.model_id,
            model_name=self.model_name,
            metrics=self.metrics,
        )

        return {
            "id": self.model_id,
            "modelName": self.model_name,
            "algorithm": self.algorithm,
            "hyperparameters": self.hyperparameters,
            "metrics": self.metrics,
            "artifactManifest": self.last_artifact_manifest,
            "isActive": True,
            "trainedAt": self.trained_at,
        }

    def get_mlops_status(self) -> dict[str, Any]:
        drift_reports = self.drift_detector.compute_drift()
        for report in drift_reports:
            ML_FEATURE_DRIFT_PSI.labels(service="fraud-service", feature=report.feature_name).set(report.psi)
        return {
            "modelId": self.model_id,
            "modelName": self.model_name,
            "algorithm": self.algorithm,
            "trainedAt": self.trained_at,
            "metrics": self.metrics,
            "artifactManifest": self.last_artifact_manifest,
            "driftReport": [
                {
                    "feature": r.feature_name,
                    "psi": r.psi,
                    "status": r.status,
                    "baselineMean": r.baseline_mean,
                    "currentMean": r.current_mean,
                }
                for r in drift_reports
            ],
        }

    def extract_features(self, request: AssessRiskRequest, velocity_count: int = 1) -> np.ndarray:
        amount = float(request.amount or 0.0)
        hour = float(request.metadata.get("hourOfDay", 12.0))
        failed_attempts = float(request.metadata.get("failedAttemptsCount", 0.0))

        # Vector: [amount, velocity, failed_attempts, hour]
        feature_vector = np.array([[amount, float(velocity_count), failed_attempts, hour]])
        return feature_vector

    def predict_anomaly(self, request: AssessRiskRequest, velocity_count: int = 1) -> tuple[int, SignalDetail | None]:
        """
        Returns an additional risk score delta (0-25) and an explanatory SignalDetail if anomalous.
        """
        start_ns = time.perf_counter_ns()
        try:
            features = self.extract_features(request, velocity_count)
            self.drift_detector.record_sample(features)
            # IsolationForest predict returns -1 for anomalies, +1 for inliers
            prediction = self._model.predict(features)[0]
            raw_score = self._model.score_samples(features)[0]

            if prediction == -1 or raw_score < -0.60:
                # Assign 15-25 score delta based on anomaly severity
                score_delta = min(25, max(15, int(abs(raw_score) * 30)))
                signal = SignalDetail(
                    name="ml_multidimensional_anomaly",
                    scoreDelta=score_delta,
                    reason=f"IsolationForest detected behavioral statistical anomaly (anomaly_score={raw_score:.3f})",
                )
                return score_delta, signal
            return 0, None

        except Exception as e:
            logger.warn("ML anomaly scoring skipped due to feature extraction error", error=str(e))
            return 0, None
        finally:
            elapsed = (time.perf_counter_ns() - start_ns) / 1e9
            ML_INFERENCE_LATENCY_SECONDS.labels(service="fraud-service", model_name=self.model_name).observe(elapsed)


ml_engine = MLEngine()
