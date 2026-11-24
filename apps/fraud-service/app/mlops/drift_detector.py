from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass

import numpy as np

FEATURE_NAMES = ["amount", "velocity", "failed_attempts", "hour"]


@dataclass(frozen=True)
class FeatureDriftReport:
    feature_name: str
    psi: float
    status: str  # "OK" | "MODERATE_DRIFT" | "HIGH_DRIFT"
    baseline_mean: float
    current_mean: float


class FeatureDriftDetector:
    """
    Computes Population Stability Index (PSI) for online fraud inference features
    against the active model's baseline training distribution.
    """

    def __init__(self, baseline_data: np.ndarray, window_size: int = 500, num_bins: int = 5) -> None:
        self._window_size = window_size
        self._num_bins = num_bins
        self._window: deque[np.ndarray] = deque(maxlen=window_size)
        self._baseline_edges: list[np.ndarray] = []
        self._baseline_props: list[np.ndarray] = []
        self._baseline_means: list[float] = []
        self.fit_baseline(baseline_data)

    def fit_baseline(self, baseline_data: np.ndarray) -> None:
        self._baseline_edges.clear()
        self._baseline_props.clear()
        self._baseline_means.clear()

        for col_idx in range(baseline_data.shape[1]):
            col = baseline_data[:, col_idx]
            self._baseline_means.append(float(np.mean(col)))
            quantiles = np.linspace(0, 100, self._num_bins + 1)
            edges = np.percentile(col, quantiles)
            # Ensure strictly increasing bin edges when variance is 0
            edges = np.unique(edges)
            if len(edges) < 2:
                edges = np.array([float(col.min()) - 0.5, float(col.max()) + 0.5])
            edges[0] = -np.inf
            edges[-1] = np.inf
            counts, _ = np.histogram(col, bins=edges)
            props = np.clip(counts / max(len(col), 1), 1e-4, 1.0)
            self._baseline_edges.append(edges)
            self._baseline_props.append(props)

    def record_sample(self, feature_vector: np.ndarray) -> None:
        vec = np.asarray(feature_vector, dtype=float).reshape(-1)
        if vec.shape[0] == len(FEATURE_NAMES) and np.all(np.isfinite(vec)):
            self._window.append(vec)

    def compute_drift(self) -> list[FeatureDriftReport]:
        if len(self._window) < 10:
            return [
                FeatureDriftReport(
                    feature_name=name,
                    psi=0.0,
                    status="OK",
                    baseline_mean=self._baseline_means[idx],
                    current_mean=self._baseline_means[idx],
                )
                for idx, name in enumerate(FEATURE_NAMES)
            ]

        current = np.vstack(list(self._window))
        reports: list[FeatureDriftReport] = []
        for idx, name in enumerate(FEATURE_NAMES):
            col = current[:, idx]
            edges = self._baseline_edges[idx]
            expected = self._baseline_props[idx]
            counts, _ = np.histogram(col, bins=edges)
            actual = np.clip(counts / max(len(col), 1), 1e-4, 1.0)
            psi = float(np.sum((actual - expected) * np.log(actual / expected)))
            if math.isnan(psi) or math.isinf(psi):
                psi = 0.0

            if psi >= 0.25:
                drift_status = "HIGH_DRIFT"
            elif psi >= 0.10:
                drift_status = "MODERATE_DRIFT"
            else:
                drift_status = "OK"

            reports.append(
                FeatureDriftReport(
                    feature_name=name,
                    psi=round(psi, 4),
                    status=drift_status,
                    baseline_mean=round(self._baseline_means[idx], 4),
                    current_mean=round(float(np.mean(col)), 4),
                )
            )
        return reports
