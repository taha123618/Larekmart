import os
from typing import Any
import numpy as np
from sklearn.ensemble import IsolationForest
from app.core.logging import get_logger
from app.schemas.fraud import AssessRiskRequest, SignalDetail

logger = get_logger("fraud-service.ml")


class MLEngine:
    """
    scikit-learn Anomaly Detection Engine.
    Employs an IsolationForest model to calculate statistical multidimensional anomaly scores.
    Augments the deterministic rule engine without black-box overriding.
    """

    def __init__(self):
        # Baseline model initialized with simulated benign e-commerce feature distribution
        self._model = IsolationForest(
            n_estimators=50,
            contamination=0.05,
            random_state=42,
        )
        # Pre-fit on synthetic normative baseline
        synthetic_normal_data = np.array([
            [1000.0, 1.0, 0.0, 12.0],
            [2500.0, 2.0, 0.0, 14.0],
            [5000.0, 1.0, 0.0, 18.0],
            [15000.0, 3.0, 0.0, 20.0],
            [500.0, 1.0, 0.0, 9.0],
            [8000.0, 2.0, 0.0, 16.0],
            [20000.0, 4.0, 0.0, 21.0],
            [3000.0, 1.0, 0.0, 11.0],
        ])
        self._model.fit(synthetic_normal_data)
        self.is_ready = True

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
        try:
            features = self.extract_features(request, velocity_count)
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


ml_engine = MLEngine()
