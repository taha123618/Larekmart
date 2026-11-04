/**
 * In-Flight Concurrency Bulkhead Guardrail
 *
 * Prevents downstream service saturation during chaos (network partitions,
 * database latency spikes, or circuit breaker trips) by enforcing strict
 * concurrency caps on critical transactional routes.
 */

export class InFlightBulkhead {
  private activeCounts = new Map<string, number>();

  public acquire(category: string, maxConcurrent: number): boolean {
    const current = this.activeCounts.get(category) ?? 0;
    if (current >= maxConcurrent) {
      return false;
    }
    this.activeCounts.set(category, current + 1);
    return true;
  }

  public release(category: string): void {
    const current = this.activeCounts.get(category) ?? 0;
    if (current > 0) {
      this.activeCounts.set(category, current - 1);
    }
  }

  public getActive(category: string): number {
    return this.activeCounts.get(category) ?? 0;
  }

  public getAllActive(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of this.activeCounts.entries()) {
      result[key] = value;
    }
    return result;
  }

  public getCapacity(
    category: string,
    isDegraded: boolean,
  ): { active: number; limit: number; utilization: number } {
    const active = this.getActive(category);
    const limit = InFlightBulkhead.getMaxConcurrent(category, isDegraded);
    const utilization = limit > 0 ? active / limit : 0;
    return { active, limit, utilization };
  }

  public reset(): void {
    this.activeCounts.clear();
  }

  public static getCategoryForRoute(url: string): string | null {
    if (url.includes("/checkout")) {
      return "checkout";
    }
    if (url.includes("/payments") || url.includes("/sessions")) {
      return "payments";
    }
    return null;
  }

  public static getMaxConcurrent(
    category: string,
    isDegraded: boolean,
  ): number {
    if (category === "checkout") {
      const defaultLimit =
        Number(process.env.BULKHEAD_MAX_CHECKOUT_CONCURRENT) || 50;
      const degradedLimit =
        Number(process.env.BULKHEAD_DEGRADED_CHECKOUT_CONCURRENT) ||
        Math.max(1, Math.floor(defaultLimit / 10));
      return isDegraded ? degradedLimit : defaultLimit;
    }
    if (category === "payments") {
      const defaultLimit =
        Number(process.env.BULKHEAD_MAX_PAYMENT_CONCURRENT) || 30;
      const degradedLimit =
        Number(process.env.BULKHEAD_DEGRADED_PAYMENT_CONCURRENT) ||
        Math.max(1, Math.floor(defaultLimit / 10));
      return isDegraded ? degradedLimit : defaultLimit;
    }
    const defaultLimit =
      Number(process.env.BULKHEAD_MAX_GENERAL_CONCURRENT) || 100;
    const degradedLimit =
      Number(process.env.BULKHEAD_DEGRADED_GENERAL_CONCURRENT) ||
      Math.max(1, Math.floor(defaultLimit / 10));
    return isDegraded ? degradedLimit : defaultLimit;
  }
}

export const inFlightBulkhead = new InFlightBulkhead();
