from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from app.mlops.validator import evaluate_model_quality_gate
from sklearn.ensemble import IsolationForest


@dataclass(frozen=True)
class TuningResult:
    best_params: dict[str, Any]
    best_margin: float
    trials_evaluated: int


def tune_isolation_forest(
    training_data: np.ndarray,
    n_estimators_grid: tuple[int, ...] = (50, 100),
    contamination_grid: tuple[float, ...] = (0.03, 0.05, 0.08),
    random_state: int = 42,
) -> TuningResult:
    """
    Performs deterministic grid search over IsolationForest hyperparameters,
    selecting the configuration that maximizes the benign-vs-adversarial separation margin.
    """
    best_params: dict[str, Any] = {
        "n_estimators": n_estimators_grid[0],
        "contamination": contamination_grid[0],
        "random_state": random_state,
    }
    best_margin = float("-inf")
    trials = 0

    for n_est in n_estimators_grid:
        for contam in contamination_grid:
            trials += 1
            candidate = IsolationForest(
                n_estimators=n_est,
                contamination=contam,
                random_state=random_state,
            )
            candidate.fit(training_data)
            gate = evaluate_model_quality_gate(candidate, training_data, min_separation_margin=0.0)
            if gate.separation_margin > best_margin:
                best_margin = gate.separation_margin
                best_params = {
                    "n_estimators": n_est,
                    "contamination": contam,
                    "random_state": random_state,
                }

    return TuningResult(
        best_params=best_params,
        best_margin=round(best_margin, 4),
        trials_evaluated=trials,
    )
