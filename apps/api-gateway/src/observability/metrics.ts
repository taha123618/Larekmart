import {
  createCounter,
  createHistogram,
  createMetricsRegistry,
} from "@repo/monitoring";

const SERVICE_NAME = "api-gateway";

export const metrics = createMetricsRegistry(SERVICE_NAME);

export const gatewayRequestsTotal = createCounter(
  metrics,
  "gateway_requests_total",
  "Total incoming requests to API gateway",
);

export const gatewayRequestDurationSeconds = createHistogram(
  metrics,
  "gateway_request_duration_seconds",
  "Duration of proxy requests through gateway in seconds",
);

export const gatewayRequestErrorsTotal = createCounter(
  metrics,
  "gateway_request_errors_total",
  "Total gateway processing errors",
);

export const gatewayUpstreamErrorsTotal = createCounter(
  metrics,
  "gateway_upstream_errors_total",
  "Total upstream service errors encountered by gateway",
);

export const gatewayUpstreamTimeoutTotal = createCounter(
  metrics,
  "gateway_upstream_timeout_total",
  "Total upstream service timeouts encountered by gateway",
);

export const gatewayRateLimitHitsTotal = createCounter(
  metrics,
  "gateway_rate_limit_hits_total",
  "Total rate limit rejections executed by gateway",
);
