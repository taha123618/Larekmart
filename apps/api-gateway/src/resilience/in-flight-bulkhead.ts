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
      return isDegraded ? 5 : 50;
    }
    if (category === "payments") {
      return isDegraded ? 5 : 30;
    }
    return isDegraded ? 10 : 100;
  }
}

export const inFlightBulkhead = new InFlightBulkhead();
