from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import httpx

from app.core.logging import get_logger

logger = get_logger("recommendation-service.mlops.registry")


class RecommendationRegistryClient:
    """
    Logs recommendation training runs, hyperparameters, and offline ranking metrics
    to MLflow Tracking Server with graceful local manifest persistence.
    """

    def __init__(self, artifact_dir: str | None = None, mlflow_uri: str | None = None) -> None:
        self.artifact_dir = Path(artifact_dir or os.getenv("ML_ARTIFACT_DIR", "./ml_artifacts/recommendation"))
        self.mlflow_uri = mlflow_uri or os.getenv("MLFLOW_TRACKING_URI", "")

    def register_run(
        self,
        model_name: str,
        version: str,
        parameters: dict[str, Any],
        metrics: dict[str, Any],
    ) -> dict[str, Any]:
        self.artifact_dir.mkdir(parents=True, exist_ok=True)
        manifest = {
            "model_name": model_name,
            "version": version,
            "parameters": parameters,
            "metrics": metrics,
        }
        manifest_path = self.artifact_dir / f"{model_name}_{version}.manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2))
        manifest["manifest_path"] = str(manifest_path)
        manifest["mlflow_run_id"] = self._log_to_mlflow_best_effort(model_name, version, parameters, metrics)
        return manifest

    def _log_to_mlflow_best_effort(
        self,
        model_name: str,
        version: str,
        parameters: dict[str, Any],
        metrics: dict[str, Any],
    ) -> str | None:
        if not self.mlflow_uri:
            return None
        try:
            with httpx.Client(timeout=2.0) as client:
                exp_resp = client.post(
                    f"{self.mlflow_uri.rstrip('/')}/api/2.0/mlflow/experiments/get-by-name",
                    params={"experiment_name": "larekmart-recommendations"},
                )
                if exp_resp.status_code == 200:
                    exp_id = exp_resp.json()["experiment"]["experiment_id"]
                else:
                    create_exp = client.post(
                        f"{self.mlflow_uri.rstrip('/')}/api/2.0/mlflow/experiments/create",
                        json={"name": "larekmart-recommendations"},
                    )
                    exp_id = create_exp.json().get("experiment_id", "0")

                run_resp = client.post(
                    f"{self.mlflow_uri.rstrip('/')}/api/2.0/mlflow/runs/create",
                    json={"experiment_id": exp_id, "run_name": f"{model_name}-{version}"},
                )
                run_id = run_resp.json()["run"]["info"]["run_id"]
                params = [{"key": str(k), "value": str(v)} for k, v in parameters.items()]
                numeric_metrics = [
                    {"key": str(k), "value": float(v)}
                    for k, v in metrics.items()
                    if isinstance(v, (int, float))
                ]
                client.post(
                    f"{self.mlflow_uri.rstrip('/')}/api/2.0/mlflow/runs/log-batch",
                    json={"run_id": run_id, "params": params, "metrics": numeric_metrics},
                )
                return run_id
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            logger.warning("MLflow tracking unavailable; saved recommendation manifest locally", error=str(exc))
            return None
