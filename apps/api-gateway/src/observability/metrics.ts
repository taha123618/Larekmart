import {
  createCounter,
  createGauge,
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

export const gatewayRateLimitHitsTotal = createCounter(
  metrics,
  "gateway_rate_limit_hits_total",
  "Total rate limit rejections executed by gateway",
);

export const gatewayAuthFailuresTotal = createCounter(
  metrics,
  "gateway_auth_failures_total",
  "Total authentication and authorization failures at gateway",
);

export const gatewayProxyRequestsTotal = createCounter(
  metrics,
  "gateway_proxy_requests_total",
  "Total requests forwarded to downstream microservices",
);

export const gatewayProxyErrorsTotal = createCounter(
  metrics,
  "gateway_proxy_errors_total",
  "Total errors returned by downstream microservices",
);

export const gatewayProxyTimeoutsTotal = createCounter(
  metrics,
  "gateway_proxy_timeouts_total",
  "Total timeouts encountered when calling downstream microservices",
);

export const gatewayProxyRetriesTotal = createCounter(
  metrics,
  "gateway_proxy_retries_total",
  "Total retries initiated for safe downstream requests",
);

export const gatewayCircuitBreakerState = createGauge(
  metrics,
  "gateway_circuit_breaker_state",
  "Circuit breaker state: 0=CLOSED, 1=HALF_OPEN, 2=OPEN",
);

export const gatewayCircuitBreakerOpenTotal = createCounter(
  metrics,
  "gateway_circuit_breaker_open_total",
  "Total times circuit breaker tripped to OPEN state",
);

export const gatewayCircuitBreakerSlowCallTripsTotal = createCounter(
  metrics,
  "gateway_circuit_breaker_slow_call_trips_total",
  "Total times circuit breaker tripped to OPEN due to slow-call rate",
);

export const gatewayCircuitBreakerHalfOpenTotal = createCounter(
  metrics,
  "gateway_circuit_breaker_half_open_total",
  "Total times circuit breaker transitioned to HALF_OPEN for canary probe",
);

export const gatewayCircuitBreakerTripsTotal = createCounter(
  metrics,
  "gateway_circuit_breaker_trips_total",
  "Total circuit breaker trips partitioned by reason",
);

export const gatewayCircuitBreakerCanaryAttemptsTotal = createCounter(
  metrics,
  "gateway_circuit_breaker_canary_attempts_total",
  "Total canary probes executed in HALF_OPEN state partitioned by result",
);

export const gateway4xxTotal = createCounter(
  metrics,
  "gateway_4xx_total",
  "Total client 4xx responses returned by gateway",
);

export const gateway5xxTotal = createCounter(
  metrics,
  "gateway_5xx_total",
  "Total server 5xx responses returned by gateway",
);

export const gatewaySingleFlightCallsTotal = createCounter(
  metrics,
  "gateway_singleflight_calls_total",
  "Total operations processed through SingleFlight coalescing",
);

export const gatewaySingleFlightSharedTotal = createCounter(
  metrics,
  "gateway_singleflight_shared_total",
  "Total concurrent duplicate requests coalesced to an in-flight promise",
);

// Aliases for backwards compatibility
export const gatewayUpstreamErrorsTotal = gatewayProxyErrorsTotal;
export const gatewayUpstreamTimeoutTotal = gatewayProxyTimeoutsTotal;
