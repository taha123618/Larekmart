import { logger } from "../observability/logger.js";
import { gatewayCircuitBreakerOpenTotal } from "../observability/metrics.js";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerConfig {
  failureThreshold?: number; // Failures before tripping
  cooldownPeriodMs?: number; // Milliseconds before attempting HALF_OPEN
  successThreshold?: number; // Successes in HALF_OPEN before resetting to CLOSED
}

interface CircuitRecord {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export class CircuitBreaker {
  private circuits = new Map<string, CircuitRecord>();
  private readonly failureThreshold: number;
  private readonly cooldownPeriodMs: number;
  private readonly successThreshold: number;

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5;
    this.cooldownPeriodMs = config.cooldownPeriodMs ?? 15000;
    this.successThreshold = config.successThreshold ?? 2;
  }

  private getRecord(service: string): CircuitRecord {
    let record = this.circuits.get(service);
    if (!record) {
      record = {
        state: "CLOSED",
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
      };
      this.circuits.set(service, record);
    }
    return record;
  }

  public getState(service: string): CircuitState {
    const record = this.getRecord(service);
    const now = Date.now();

    if (record.state === "OPEN" && now >= record.nextAttemptTime) {
      record.state = "HALF_OPEN";
      record.successes = 0;
      logger.info(
        `Circuit breaker transitioned to HALF_OPEN for service: ${service}`,
      );
    }

    return record.state;
  }

  public isAvailable(service: string): boolean {
    const state = this.getState(service);
    return state === "CLOSED" || state === "HALF_OPEN";
  }

  public recordSuccess(service: string): void {
    const record = this.getRecord(service);
    if (record.state === "HALF_OPEN") {
      record.successes++;
      if (record.successes >= this.successThreshold) {
        record.state = "CLOSED";
        record.failures = 0;
        logger.info(`Circuit breaker RESET to CLOSED for service: ${service}`);
      }
    } else if (record.state === "CLOSED") {
      record.failures = 0;
    }
  }

  public recordFailure(service: string): void {
    const record = this.getRecord(service);
    const now = Date.now();
    record.lastFailureTime = now;

    if (record.state === "HALF_OPEN") {
      record.state = "OPEN";
      record.nextAttemptTime = now + this.cooldownPeriodMs;
      gatewayCircuitBreakerOpenTotal.inc({ service });
      logger.warn(
        `Circuit breaker tripped to OPEN from HALF_OPEN for service: ${service}`,
      );
      return;
    }

    record.failures++;
    if (record.failures >= this.failureThreshold) {
      record.state = "OPEN";
      record.nextAttemptTime = now + this.cooldownPeriodMs;
      gatewayCircuitBreakerOpenTotal.inc({ service });
      logger.warn(
        `Circuit breaker tripped to OPEN for service: ${service} (${record.failures} failures)`,
        {
          service,
          cooldownPeriodMs: this.cooldownPeriodMs,
        },
      );
    }
  }

  public reset(service?: string): void {
    if (service) {
      this.circuits.delete(service);
    } else {
      this.circuits.clear();
    }
  }
}

export const circuitBreaker = new CircuitBreaker();
