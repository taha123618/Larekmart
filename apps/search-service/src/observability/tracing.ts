import { logger } from "./metrics.js";
import { config } from "../config/config.js";

export interface SpanContext {
  traceId?: string;
  spanId?: string;
}

export function initTracing(): void {
  if (config.monitoring.otlpEndpoint) {
    logger.info("OpenTelemetry OTLP tracing enabled", {
      service: config.monitoring.serviceName,
      endpoint: config.monitoring.otlpEndpoint,
    });
  } else {
    logger.debug("OpenTelemetry OTLP endpoint not configured; using local structured spans");
  }
}
