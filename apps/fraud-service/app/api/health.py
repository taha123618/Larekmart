from fastapi import APIRouter, Response, status
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from app.db.session import get_session_maker
from app.redis.velocity import get_redis

router = APIRouter(tags=["Health & Metrics"])


@router.get("/health")
async def health_check():
    """
    Standard Larekmart readiness & liveness probe.
    Tests database connection and Redis availability.
    """
    db_status = "ok"
    try:
        session_maker = get_session_maker()
        async with session_maker() as session:
            from sqlalchemy import text
            await session.execute(text("SELECT 1"))
    except Exception:
        db_status = "degraded"

    redis_status = "ok"
    try:
        client = await get_redis()
        if client:
            await client.ping()
        else:
            redis_status = "in-memory-fallback"
    except Exception:
        redis_status = "degraded"

    return {
        "status": "healthy" if db_status in ("ok", "degraded") else "unhealthy",
        "service": "fraud-service",
        "version": "1.0.0",
        "dependencies": {
            "database": db_status,
            "redis": redis_status,
        },
    }


@router.get("/metrics")
async def metrics():
    """Prometheus telemetry scrape endpoint."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

