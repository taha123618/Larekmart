from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import IsolationForest


@dataclass(frozen=True)
class ValidationResult:
    passed: bool
    reason: str
    separation_margin: float = 0.0


def validate_training_dataset(data: np.ndarray) -> ValidationResult:
    """Validates feature matrix schema, finiteness, and domain bounds before training."""
    if data.ndim != 2 or data.shape[1] != 4:
        return ValidationResult(passed=False, reason=f"Expected 2D matrix with 4 features, got shape {data.shape}")
    if data.shape[0] < 10:
        return ValidationResult(passed=False, reason=f"Insufficient training samples: {data.shape[0]} < 10")
    if not np.all(np.isfinite(data)):
        return ValidationResult(passed=False, reason="Training dataset contains NaN or Inf values")
    if np.any(data[:, 0] < 0) or np.any(data[:, 1] < 0) or np.any(data[:, 2] < 0):
        return ValidationResult(passed=False, reason="Negative values found in amount, velocity, or failed_attempts")
    if np.any((data[:, 3] < 0) | (data[:, 3] > 24)):
        return ValidationResult(passed=False, reason="Hour of day must be within [0, 24]")
    return ValidationResult(passed=True, reason="Dataset schema and bounds valid")


def evaluate_model_quality_gate(
    model: IsolationForest,
    benign_data: np.ndarray,
    min_separation_margin: float = 0.02,
) -> ValidationResult:
    """
    Model Quality Gate: Verifies that the trained IsolationForest clearly separates
    benign baseline traffic from canonical adversarial fraud outliers.
    """
    adversarial_probe = np.array([
        [10_000_000.0, 50.0, 20.0, 3.0],
        [5_000_000.0, 35.0, 12.0, 2.0],
    ])
    benign_scores = model.score_samples(benign_data)
    adversarial_scores = model.score_samples(adversarial_probe)
    margin = float(np.mean(benign_scores) - np.mean(adversarial_scores))

    if margin < min_separation_margin:
        return ValidationResult(
            passed=False,
            reason=f"Model failed quality gate: separation margin {margin:.4f} < {min_separation_margin}",
            separation_margin=margin,
        )
    return ValidationResult(
        passed=True,
        reason="Model passed anomaly separation quality gate",
        separation_margin=round(margin, 4),
    )
