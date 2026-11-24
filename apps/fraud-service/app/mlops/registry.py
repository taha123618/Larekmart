from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

import httpx
import joblib
from app.core.logging import get_logger

logger = get_logger("fraud-service.mlops.registry")


class ModelRegistryClient:
    """
    Persists trained model artifacts locally with SHA-256 integrity digests and
    optionally logs experiment runs to an MLflow Tracking Server via REST API.
    """

    def __init__(self, artifact_dir: str | None = None, mlflow_uri: str | None = None) -> None:
        self.artifact_dir = Path(artifact_dir or os.getenv("ML_ARTIFACT_DIR", "./ml_artifacts/fraud"))
        self.mlflow_uri = mlflow_uri or os.getenv("MLFLOW_TRACKING_URI", "")

    def save_and_register(
        self,
        model: Any,
        model_id: str,
        model_name: str,
        hyperparameters: dict[str, Any],
        metrics: dict[str, Any],
    ) -> dict[str, Any]:
        self.artifact_dir.mkdir(parents=True, exist_ok=True)
        model_path = self.artifact_dir / f"{model_name}_{model_id}.joblib"
        joblib.dump(model, model_path)

        sha256_hash = hashlib.sha256(model_path.read_bytes()).hexdigest()
        manifest_path = self.artifact_dir / f"{model_name}_{model_id}.manifest.json"
        manifest = {
            "model_id": model_id,
            "model_name": model_name,
            "artifact_path": str(model_path),
            "sha256": sha256_hash,
            "hyperparameters": hyperparameters,
            "metrics": metrics,
        }
        manifest_path.write_text(json.dumps(manifest, indent=2))

        mlflow_run_id = self._log_to_mlflow_best_effort(model_name, hyperparameters, metrics, sha256_hash)
        manifest["mlflow_run_id"] = mlflow_run_id
        return manifest

    def _log_to_mlflow_best_effort(
        self,
        model_name: str,
        hyperparameters: dict[str, Any],
        metrics: dict[str, Any],
        sha256_hash: str,
    ) -> str | None:
        if not self.mlflow_uri:
            return None
        try:
            with httpx.Client(timeout=2.0) as client:
                exp_resp = client.post(
                    f"{self.mlflow_uri.rstrip('/')}/api/2.0/mlflow/experiments/get-by-name",
                    params={"experiment_name": "larekmart-fraud-detection"},
                )
                if exp_resp.status_code == 200:
                    exp_id = exp_resp.json()["experiment"]["experiment_id"]
                else:
                    create_exp = client.post(
                        f"{self.mlflow_uri.rstrip('/')}/api/2.0/mlflow/experiments/create",
                        json={"name": "larekmart-fraud-detection"},
                    )
                    exp_id = create_exp.json().get("experiment_id", "0")

                run_resp = client.post(
                    f"{self.mlflow_uri.rstrip('/')}/api/2.0/mlflow/runs/create",
                    json={"experiment_id": exp_id, "run_name": model_name},
                )
                run_id = run_resp.json()["run"]["info"]["run_id"]
                params = [{"key": str(k), "value": str(v)} for k, v in hyperparameters.items()]
                params.append({"key": "artifact_sha256", "value": sha256_hash})
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
            logger.warning("MLflow tracking unavailable; persisted locally", error=str(exc))
            return None
