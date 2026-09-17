from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from app.core.config import get_settings


def setup_telemetry(app: FastAPI) -> None:
    settings = get_settings()

    resource = Resource.create(attributes={
        "service.name": settings.OTEL_SERVICE_NAME,
        "deployment.environment": settings.APP_ENV,
    })

    provider = TracerProvider(resource=resource)
    trace.set_tracer_provider(provider)

    # Instrument FastAPI application routes
    FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)


def get_tracer(name: str = "recommendation-service") -> trace.Tracer:
    return trace.get_tracer(name)
