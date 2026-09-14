from typing import Any
from fastapi import APIRouter, Response, status
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from sqlalchemy import text

from app.cache.redis import get_redis_cache
from app.core.config import get_settings
from app.db.session import async_session_factory

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_summary() -> dict[str, str]:
    settings = get_settings()
    return {
        "service": settings.app_name,
        "status": "healthy",
        "environment": settings.app_env,
        "version": "1.0.0",
    }


@router.get("/health/live")
async def liveness_probe() -> dict[str, str]:
    """Kubernetes liveness probe: verifies process is alive and accepting connections."""
    return {"status": "alive"}


@router.get("/health/ready")
async def readiness_probe(response: Response) -> dict[str, Any]:
    """Kubernetes readiness probe: verifies database and cache connectivity."""
    checks: dict[str, str] = {}
    is_ready = True

    # 1. Database check
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        checks["postgres"] = "healthy"
    except Exception as exc:
        checks["postgres"] = f"unhealthy: {exc}"
        is_ready = False

    # 2. Redis check (non-critical cache degradation allowed in readiness)
    try:
        cache = get_redis_cache()
        ping_ok = await cache.ping()
        checks["redis"] = "healthy" if ping_ok else "unavailable"
    except Exception as exc:
        checks["redis"] = f"degraded: {exc}"

    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "ready" if is_ready else "unready",
        "checks": checks,
    }


@router.get("/metrics")
async def prometheus_metrics() -> Response:
    """Prometheus telemetry scrape endpoint."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
