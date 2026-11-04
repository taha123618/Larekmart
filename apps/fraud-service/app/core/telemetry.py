from fastapi import FastAPI
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("fraud-service.telemetry")


def setup_telemetry(app: FastAPI) -> None:
    """Configures OpenTelemetry distributed tracing for FastAPI routes."""
    settings = get_settings()
    if not settings.OTEL_TRACING_ENABLED:
        logger.info("OpenTelemetry tracing is disabled by configuration")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider

        resource = Resource.create(
            attributes={
                "service.name": settings.OTEL_SERVICE_NAME,
                "deployment.environment": settings.APP_ENV,
            }
        )

        provider = TracerProvider(resource=resource)
        trace.set_tracer_provider(provider)
        FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)
        logger.info("OpenTelemetry tracing initialized successfully", service=settings.OTEL_SERVICE_NAME)
    except Exception as e:
        logger.warn("OpenTelemetry instrumentation skipped or failed to initialize", error=str(e))

