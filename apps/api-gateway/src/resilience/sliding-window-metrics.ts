/**
 * Sliding Window Metrics
 *
 * Implements a time-bucket rolling window (10 × 1-second buckets = 10s window)
 * tracking per-service call outcomes for the circuit breaker.
 *
 * Each second a new bucket is created; buckets older than the window are
 * evicted so the counters always reflect only the last 10 seconds.
 *
 * Tracks:
 *   - total calls
 *   - failed calls (HTTP 5xx or network/proxy errors)
 *   - slow calls (latency ≥ slowCallThresholdMs)
 *
 * Derived metrics:
 *   - failure rate = failed / total  (NaN → 0 when total = 0)
 *   - slow call rate = slow / total
 */

export interface WindowBucket {
  ts: number; // bucket start epoch-second
  total: number;
  failed: number;
  slow: number;
}

export interface WindowSnapshot {
  total: number;
  failed: number;
  slow: number;
  failureRate: number; // [0, 1]
  slowCallRate: number; // [0, 1]
}

export class SlidingWindowMetrics {
  /**
   * Number of 1-second time buckets retained (= window duration in seconds).
   */
  private readonly windowSize: number;

  /**
   * Per-service ring of time-buckets.
   */
  private buckets = new Map<string, WindowBucket[]>();

  constructor(windowSize = 10) {
    this.windowSize = windowSize;
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private currentSecond(): number {
    return Math.floor(Date.now() / 1000);
  }

  private getServiceBuckets(service: string): WindowBucket[] {
    let list = this.buckets.get(service);
    if (!list) {
      list = [];
      this.buckets.set(service, list);
    }
    return list;
  }

  /**
   * Evict buckets outside the rolling window and ensure the current second
   * has a live bucket, returning that bucket.
   */
  private currentBucket(service: string): WindowBucket {
    const now = this.currentSecond();
    const list = this.getServiceBuckets(service);

    // Evict stale buckets
    const cutoff = now - this.windowSize;
    let start = 0;
    while (start < list.length && list[start]!.ts <= cutoff) {
      start++;
    }
    if (start > 0) list.splice(0, start);

    // Ensure current-second bucket exists at tail
    const last = list[list.length - 1];
    if (!last || last.ts !== now) {
      const bucket: WindowBucket = { ts: now, total: 0, failed: 0, slow: 0 };
      list.push(bucket);
      return bucket;
    }
    return last;
  }

  // ── public API ────────────────────────────────────────────────────────────

  /**
   * Record a completed call outcome.
   *
   * @param service               Downstream service name
   * @param failed                Whether this call is counted as a failure
   * @param latencyMs             Observed round-trip latency in milliseconds
   * @param slowCallThresholdMs   Latency threshold above which a call is "slow"
   */
  public record(
    service: string,
    failed: boolean,
    latencyMs: number,
    slowCallThresholdMs: number,
  ): void {
    const bucket = this.currentBucket(service);
    bucket.total++;
    if (failed) bucket.failed++;
    if (latencyMs >= slowCallThresholdMs) bucket.slow++;
  }

  /**
   * Return aggregate metrics across the full rolling window.
   */
  public snapshot(service: string): WindowSnapshot {
    // Evict stale buckets before snapshotting
    this.currentBucket(service);

    const list = this.getServiceBuckets(service);
    let total = 0;
    let failed = 0;
    let slow = 0;

    for (const b of list) {
      total += b.total;
      failed += b.failed;
      slow += b.slow;
    }

    return {
      total,
      failed,
      slow,
      failureRate: total === 0 ? 0 : failed / total,
      slowCallRate: total === 0 ? 0 : slow / total,
    };
  }

  /**
   * Reset metrics for one service (or all services).
   */
  public reset(service?: string): void {
    if (service) {
      this.buckets.delete(service);
    } else {
      this.buckets.clear();
    }
  }
}
