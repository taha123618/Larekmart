/**
 * Dynamic Circuit Breaker — Self-Tuning with Sliding Window Metrics
 *
 * Architecture decisions (from /grill-me design interview):
 *
 *  Tripping criteria  — HYBRID:
 *    • Failure rate  ≥ failureRateThreshold (default 50%) over a 10 × 1s window
 *    • Slow-call rate ≥ slowCallRateThreshold (default 50%) where slow = latency ≥ slowCallThresholdMs (default 2 000ms)
 *    • Minimum window volume = minWindowCalls (default 5) — prevents tripping on 1-of-1 calls
 *
 *  Tiered degradation —
 *    • Non-critical services (read-only GETs):  stub fallback, no circuit trip signal to caller
 *    • Transactional writes + critical services: fail-closed 503 with Retry-After
 *
 *  Exponential canary recovery —
 *    HALF_OPEN probe interval starts at halfOpenInitialMs (default 15s) and
 *    doubles on each failed probe up to halfOpenMaxMs (default 120s).
 *    Adds ±20% jitter so multiple services don't thunderherd simultaneously.
 *    Three consecutive successes required to re-CLOSE the circuit.
 *
 *  Upstream health feedback —
 *    The proxy layer can call feedUpstreamRetryAfter(service, seconds) when
 *    the downstream response carries a Retry-After header (HTTP 429 / 503).
 *    The circuit immediately jumps to OPEN and will not probe before that
 *    server-recommended instant.
 */

import { logger } from "../observability/logger.js";
import {
  gatewayCircuitBreakerOpenTotal,
  gatewayCircuitBreakerSlowCallTripsTotal,
  gatewayCircuitBreakerHalfOpenTotal,
  gatewayCircuitBreakerState,
  gatewayCircuitBreakerTripsTotal,
  gatewayCircuitBreakerCanaryAttemptsTotal,
} from "../observability/metrics.js";
import { SlidingWindowMetrics } from "./sliding-window-metrics.js";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

// ── Configuration ─────────────────────────────────────────────────────────────

export interface CircuitBreakerConfig {
  /** Minimum calls in window before tripping thresholds are evaluated */
  minWindowCalls?: number;
  /** Failure-rate threshold in [0,1] that triggers a trip (default 0.5 = 50%) */
  failureRateThreshold?: number;
  /** Slow-call-rate threshold in [0,1] that triggers a trip (default 0.5 = 50%) */
  slowCallRateThreshold?: number;
  /** Latency in ms above which a call is considered "slow" (default 2 000ms) */
  slowCallThresholdMs?: number;
  /** Rolling window size in seconds (default 10) */
  windowSizeSeconds?: number;
  /** Initial HALF_OPEN probe delay in ms (default 15 000ms = 15s) */
  halfOpenInitialMs?: number;
  /** Maximum HALF_OPEN probe delay after repeated failures (default 120 000ms) */
  halfOpenMaxMs?: number;
  /** Consecutive successes required in HALF_OPEN to CLOSE (default 3) */
  successThreshold?: number;
  /** Max concurrent canary probes permitted in HALF_OPEN (default 2) */
  canaryConcurrencyLimit?: number;
}

// ── Internal state per service ────────────────────────────────────────────────

interface CircuitRecord {
  state: CircuitState;
  /** Epoch ms: when HALF_OPEN probes may next be attempted */
  nextAttemptTime: number;
  /** Current exponential backoff step for HALF_OPEN */
  halfOpenBackoffMs: number;
  /** Consecutive successes recorded in HALF_OPEN */
  consecutiveSuccesses: number;
  /** Active concurrent canary probes executing in HALF_OPEN */
  activeCanaryProbes: number;
}

// ── Jitter helper ─────────────────────────────────────────────────────────────

function withJitter(ms: number): number {
  // ±20% uniform jitter
  const jitter = ms * 0.2;
  return ms + Math.random() * jitter * 2 - jitter;
}

// ── CircuitBreaker ────────────────────────────────────────────────────────────

export class CircuitBreaker {
  private circuits = new Map<string, CircuitRecord>();
  private readonly metrics: SlidingWindowMetrics;

  private readonly minWindowCalls: number;
  private readonly failureRateThreshold: number;
  private readonly slowCallRateThreshold: number;
  private readonly slowCallThresholdMs: number;
  private readonly halfOpenInitialMs: number;
  private readonly halfOpenMaxMs: number;
  private readonly successThreshold: number;
  private readonly canaryConcurrencyLimit: number;

  constructor(config: CircuitBreakerConfig = {}) {
    this.minWindowCalls = config.minWindowCalls ?? 5;
    this.failureRateThreshold = config.failureRateThreshold ?? 0.5;
    this.slowCallRateThreshold = config.slowCallRateThreshold ?? 0.5;
    this.slowCallThresholdMs = config.slowCallThresholdMs ?? 2000;
    this.halfOpenInitialMs = config.halfOpenInitialMs ?? 15_000;
    this.halfOpenMaxMs = config.halfOpenMaxMs ?? 120_000;
    this.successThreshold = config.successThreshold ?? 3;
    this.canaryConcurrencyLimit = config.canaryConcurrencyLimit ?? 2;
    this.metrics = new SlidingWindowMetrics(config.windowSizeSeconds ?? 10);
  }

  // ── private helpers ─────────────────────────────────────────────────────

  private getRecord(service: string): CircuitRecord {
    let record = this.circuits.get(service);
    if (!record) {
      record = {
        state: "CLOSED",
        nextAttemptTime: 0,
        halfOpenBackoffMs: this.halfOpenInitialMs,
        consecutiveSuccesses: 0,
        activeCanaryProbes: 0,
      };
      this.circuits.set(service, record);
      gatewayCircuitBreakerState.set(0, { service });
    }
    return record;
  }

  private tripToOpen(
    service: string,
    record: CircuitRecord,
    reason: string,
    forcedRetryAfterMs?: number,
  ): void {
    const backoffMs =
      forcedRetryAfterMs ?? withJitter(record.halfOpenBackoffMs);
    record.state = "OPEN";
    record.nextAttemptTime = Date.now() + backoffMs;
    record.consecutiveSuccesses = 0;
    record.activeCanaryProbes = 0;
    gatewayCircuitBreakerOpenTotal.inc({ service });
    gatewayCircuitBreakerTripsTotal.inc({ service, reason });
    gatewayCircuitBreakerState.set(2, { service });
    logger.warn(`Circuit breaker tripped OPEN for service: ${service}`, {
      service,
      reason,
      backoffMs: Math.round(backoffMs),
    });
  }

  private promoteToHalfOpen(service: string, record: CircuitRecord): void {
    record.state = "HALF_OPEN";
    record.consecutiveSuccesses = 0;
    record.activeCanaryProbes = 0;
    // Backoff doubles on the NEXT failure in HALF_OPEN, capped at max
    record.halfOpenBackoffMs = Math.min(
      record.halfOpenBackoffMs * 2,
      this.halfOpenMaxMs,
    );
    gatewayCircuitBreakerHalfOpenTotal.inc({ service });
    gatewayCircuitBreakerState.set(1, { service });
    logger.info(
      `Circuit breaker transitioned to HALF_OPEN for service: ${service}`,
      {
        service,
        nextBackoffMs: record.halfOpenBackoffMs,
      },
    );
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Get current circuit state, applying OPEN→HALF_OPEN transition if cooldown
   * period has elapsed.
   */
  public getState(service: string): CircuitState {
    const record = this.getRecord(service);
    const now = Date.now();

    if (record.state === "OPEN" && now >= record.nextAttemptTime) {
      this.promoteToHalfOpen(service, record);
    }

    return record.state;
  }

  /**
   * Returns true if requests should be forwarded to the upstream service.
   * CLOSED is available. In HALF_OPEN, enforces canary concurrency gating
   * (only up to canaryConcurrencyLimit requests pass concurrently).
   */
  public isAvailable(service: string): boolean {
    const state = this.getState(service);
    if (state === "CLOSED") return true;
    if (state === "OPEN") return false;

    // In HALF_OPEN: concurrency gate to prevent canary stampedes
    const record = this.getRecord(service);
    if (record.activeCanaryProbes < this.canaryConcurrencyLimit) {
      record.activeCanaryProbes++;
      return true;
    }
    return false;
  }

  // ── Threshold evaluation ─────────────────────────────────────────────────

  /**
   * Evaluate sliding-window thresholds and trip to OPEN if exceeded.
   * Called after every recorded outcome in CLOSED state.
   */
  private evaluateWindow(service: string, record: CircuitRecord): void {
    if (record.state !== "CLOSED") return;

    const snap = this.metrics.snapshot(service);
    if (snap.total < this.minWindowCalls) return; // not enough data yet

    if (snap.failureRate >= this.failureRateThreshold) {
      this.tripToOpen(
        service,
        record,
        `failure-rate=${(snap.failureRate * 100).toFixed(1)}%`,
      );
    } else if (snap.slowCallRate >= this.slowCallRateThreshold) {
      gatewayCircuitBreakerSlowCallTripsTotal.inc({ service });
      this.tripToOpen(
        service,
        record,
        `slow-call-rate=${(snap.slowCallRate * 100).toFixed(1)}%`,
      );
    }
  }

  /**
   * Record a successful upstream response.
   *
   * @param service    Downstream service name
   * @param latencyMs  Round-trip latency (used to detect slow successes)
   */
  public recordSuccess(service: string, latencyMs = 0): void {
    const record = this.getRecord(service);
    this.metrics.record(service, false, latencyMs, this.slowCallThresholdMs);

    if (record.state === "HALF_OPEN") {
      record.activeCanaryProbes = Math.max(0, record.activeCanaryProbes - 1);
      gatewayCircuitBreakerCanaryAttemptsTotal.inc({
        service,
        result: "success",
      });
      record.consecutiveSuccesses++;
      if (record.consecutiveSuccesses >= this.successThreshold) {
        record.state = "CLOSED";
        // Reset backoff on a clean close
        record.halfOpenBackoffMs = this.halfOpenInitialMs;
        record.consecutiveSuccesses = 0;
        record.activeCanaryProbes = 0;
        gatewayCircuitBreakerState.set(0, { service });
        this.metrics.reset(service);
        logger.info(`Circuit breaker RESET to CLOSED for service: ${service}`, {
          service,
        });
      }
      return;
    }

    // In CLOSED state: evaluate window thresholds (slow-call rate can trip circuit
    // even when responses are HTTP 2xx if latency exceeds the slow threshold)
    this.evaluateWindow(service, record);
  }

  /**
   * Record a failed upstream call (network error or 5xx response).
   *
   * @param service    Downstream service name
   * @param latencyMs  Round-trip latency of the failed call
   */
  public recordFailure(service: string, latencyMs = 0): void {
    const record = this.getRecord(service);
    this.metrics.record(service, true, latencyMs, this.slowCallThresholdMs);

    if (record.state === "HALF_OPEN") {
      record.activeCanaryProbes = Math.max(0, record.activeCanaryProbes - 1);
      gatewayCircuitBreakerCanaryAttemptsTotal.inc({
        service,
        result: "failure",
      });
      // Any failure during probe → back to OPEN with escalated backoff
      this.tripToOpen(service, record, "probe-failure");
      return;
    }

    if (record.state === "OPEN") {
      return; // already open
    }

    // Evaluate sliding window thresholds (failure rate and slow-call rate)
    this.evaluateWindow(service, record);
  }

  /**
   * Upstream health feedback — called when a downstream response carries a
   * Retry-After header (HTTP 429 or 503).  Forces the circuit OPEN and
   * respects the server-recommended delay before the next probe.
   *
   * @param service         Downstream service name
   * @param retryAfterSecs  Value of the Retry-After response header in seconds
   */
  public feedUpstreamRetryAfter(service: string, retryAfterSecs: number): void {
    const record = this.getRecord(service);
    if (record.state === "OPEN") {
      // Extend the wait if the server wants more time than we already scheduled
      const serverWantsMs = retryAfterSecs * 1000;
      const remaining = record.nextAttemptTime - Date.now();
      if (serverWantsMs > remaining) {
        record.nextAttemptTime = Date.now() + serverWantsMs;
        logger.info(
          `Circuit breaker: upstream extended Retry-After for ${service}`,
          {
            service,
            retryAfterSecs,
          },
        );
      }
      return;
    }
    // CLOSED or HALF_OPEN → immediately trip open
    this.tripToOpen(
      service,
      record,
      `upstream-retry-after=${retryAfterSecs}s`,
      retryAfterSecs * 1000,
    );
  }

  /**
   * Read-only snapshot of the current sliding-window metrics for a service.
   */
  public windowSnapshot(service: string) {
    return this.metrics.snapshot(service);
  }

  /**
   * Reset circuit state (and optionally the metrics window) for one or all services.
   */
  public reset(service?: string): void {
    if (service) {
      this.circuits.delete(service);
      this.metrics.reset(service);
      gatewayCircuitBreakerState.set(0, { service });
    } else {
      for (const svc of this.circuits.keys()) {
        gatewayCircuitBreakerState.set(0, { service: svc });
      }
      this.circuits.clear();
      this.metrics.reset();
    }
  }
}

export const circuitBreaker = new CircuitBreaker();
