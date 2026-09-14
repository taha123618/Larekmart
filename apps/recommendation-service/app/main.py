import time
from typing import Any, Callable
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.routes import analytics, health, interactions, recommendations
from app.cache.redis import get_redis_cache
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.core.security import add_security_headers
from app.core.telemetry import setup_telemetry
from app.db.session import engine
from app.messaging.consumers.event_consumer import register_all_consumers
from app.messaging.kafka import kafka_manager
from app.observability.metrics import (
    RECOMMENDATION_REQUEST_DURATION_SECONDS,
    RECOMMENDATION_REQUESTS_TOTAL,
)

logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    configure_logging()
    logger.info("service_starting", service=settings.app_name, env=settings.app_env)

    # Initialize OpenTelemetry instrumentation
    setup_telemetry(app)

    # Pre-ping Redis cache
    cache = get_redis_cache()
    try:
        await cache.ping()
        logger.info("redis_connected")
    except Exception as exc:
        logger.warning("redis_connection_warning", error=str(exc))

    # Register and start Kafka consumer loop
    register_all_consumers()
    try:
        await kafka_manager.start()
    except Exception as exc:
        logger.warning("kafka_start_warning", error=str(exc))

    yield

    # Teardown
    logger.info("service_shutting_down")
    await kafka_manager.stop()
    await cache.close()
    await engine.dispose()
    logger.info("service_shutdown_complete")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Larekmart Recommendation Service",
        description="Personalized, collaborative, content-based, and vector similarity recommendation platform",
        version="1.0.0",
        docs_url="/docs" if settings.app_env != "production" else None,
        redoc_url="/redoc" if settings.app_env != "production" else None,
        lifespan=lifespan,
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request ID and Metrics Middleware
    class ObservabilityMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next: Any) -> Response:  # type: ignore[name-defined]
            request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
            start_time = time.perf_counter()

            # Process request
            response: Response = await call_next(request)

            duration = time.perf_counter() - start_time
            path = request.url.path
            method = request.method
            status_code = str(response.status_code)

            # Record Prometheus metrics for HTTP requests
            if path.startswith("/api/v1/recommendations"):
                endpoint_label = path.split("/")[-1] or "recommendations"
                rec_type = endpoint_label
                RECOMMENDATION_REQUESTS_TOTAL.labels(
                    endpoint=endpoint_label,
                    recommendation_type=rec_type,
                    status=status_code,
                ).inc()
                RECOMMENDATION_REQUEST_DURATION_SECONDS.labels(
                    endpoint=endpoint_label,
                    recommendation_type=rec_type,
                ).observe(duration)

            response.headers["x-request-id"] = request_id
            add_security_headers(response)
            return response

    app.add_middleware(ObservabilityMiddleware)

    # Exception Handlers
    register_exception_handlers(app)

    # Register Routers
    app.include_router(health.router)
    app.include_router(recommendations.router)
    app.include_router(interactions.router)
    app.include_router(analytics.router)

    return app


app = create_app()
