from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any
from opentelemetry import trace
import structlog

tracer = trace.get_tracer("recommendation-service")


@asynccontextmanager
async def start_span(name: str, attributes: dict[str, Any] | None = None) -> AsyncGenerator[trace.Span, None]:
    """
    Context manager to start an OpenTelemetry span and bind trace context
    to structlog for distributed tracing correlation.
    """
    with tracer.start_as_current_span(name) as span:
        if attributes:
            for k, v in attributes.items():
                span.set_attribute(k, str(v))

        ctx = span.get_span_context()
        if ctx and ctx.is_valid:
            trace_id = format(ctx.trace_id, "032x")
            span_id = format(ctx.span_id, "016x")
            structlog.contextvars.bind_contextvars(trace_id=trace_id, span_id=span_id)

        try:
            yield span
        finally:
            structlog.contextvars.unbind_contextvars("trace_id", "span_id")
