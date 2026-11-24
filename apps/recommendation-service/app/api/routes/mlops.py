import json
from typing import Any

from fastapi import APIRouter

from app.mlops.registry import RecommendationRegistryClient

router = APIRouter(prefix="/api/v1/recommendations/mlops", tags=["MLOps"])


@router.get("/status")
async def get_mlops_status() -> dict[str, Any]:
    """Returns MLOps registry configuration and latest local model training manifest."""
    client = RecommendationRegistryClient()
    manifests: list[dict[str, Any]] = []
    if client.artifact_dir.exists():
        for path in sorted(client.artifact_dir.glob("*.manifest.json"), reverse=True)[:5]:
            try:
                manifests.append(json.loads(path.read_text()))
            except (OSError, ValueError):
                continue

    return {
        "service": "recommendation-service",
        "mlflowTrackingEnabled": bool(client.mlflow_uri),
        "artifactDir": str(client.artifact_dir),
        "latestManifest": manifests[0] if manifests else None,
        "recentRunsCount": len(manifests),
    }
