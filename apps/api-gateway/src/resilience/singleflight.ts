import { logger } from "../observability/logger.js";
import {
  gatewaySingleFlightCallsTotal,
  gatewaySingleFlightSharedTotal,
  metrics,
} from "../observability/metrics.js";

export interface SingleFlightOptions {
  /** Maximum time in milliseconds before in-flight promise is detached from the registry (default: 15,000ms) */
  timeoutMs?: number;
  /** Label for metrics categorization (e.g. 'inventory-availability', 'home-featured') */
  label?: string;
}

export interface SingleFlightStats {
  inflightCount: number;
  keys: string[];
}

interface InflightCall<T> {
  promise: Promise<T>;
  waiters: number;
  startedAt: number;
  timer: NodeJS.Timeout | null;
}

/**
 * SingleFlightGroup suppresses duplicate concurrent executions of an identical function.
 * Given a key, if an operation is already executing, subsequent callers join the existing
 * promise and receive the identical result once it resolves, shielding downstream microservices
 * and databases from Thundering Herd and Cache Stampede storms.
 */
export class SingleFlightGroup {
  private calls = new Map<string, InflightCall<unknown>>();

  /**
   * Executes and returns the result of the given function, ensuring only one
   * execution is in-flight for a given key at a time. If a duplicate arrives while
   * the operation is in-flight, the duplicate caller joins the active promise.
   */
  public async do<T>(
    key: string,
    fn: () => Promise<T>,
    options: SingleFlightOptions = {},
  ): Promise<T> {
    const label = options.label || "default";
    gatewaySingleFlightCallsTotal.inc({ label });

    const existing = this.calls.get(key) as InflightCall<T> | undefined;
    if (existing) {
      existing.waiters++;
      gatewaySingleFlightSharedTotal.inc({ label });
      logger.debug(
        `SingleFlight coalesced duplicate in-flight call for key: ${key}`,
        {
          key,
          waiters: existing.waiters,
          label,
        },
      );
      return existing.promise;
    }

    const timeoutMs = options.timeoutMs ?? 15000;
    let timer: NodeJS.Timeout | null = null;

    // Create execution promise
    const promise = new Promise<T>((resolve, reject) => {
      fn()
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });

    const callRecord: InflightCall<T> = {
      promise,
      waiters: 1,
      startedAt: Date.now(),
      timer: null,
    };

    if (timeoutMs > 0 && Number.isFinite(timeoutMs)) {
      timer = setTimeout(() => {
        if (this.calls.get(key) === (callRecord as InflightCall<unknown>)) {
          logger.warn(
            `SingleFlight timeout exceeded (${timeoutMs}ms) for key: ${key}; detaching`,
            {
              key,
              label,
            },
          );
          this.cleanup(key, callRecord as InflightCall<unknown>);
        }
      }, timeoutMs);
      callRecord.timer = timer;
    }

    this.calls.set(key, callRecord as InflightCall<unknown>);
    this.updateInflightGauge();

    try {
      const result = await promise;
      return result;
    } finally {
      this.cleanup(key, callRecord as InflightCall<unknown>);
    }
  }

  private cleanup(key: string, callRecord: InflightCall<unknown>): void {
    if (callRecord.timer) {
      clearTimeout(callRecord.timer);
      callRecord.timer = null;
    }
    if (this.calls.get(key) === callRecord) {
      this.calls.delete(key);
      this.updateInflightGauge();
    }
  }

  private updateInflightGauge(): void {
    metrics.setGauge(
      "gateway_singleflight_inflight",
      this.calls.size,
      {},
      "Current active in-flight SingleFlight promises",
    );
  }

  /**
   * Returns current count and keys of in-flight promises.
   */
  public getStats(): SingleFlightStats {
    return {
      inflightCount: this.calls.size,
      keys: Array.from(this.calls.keys()),
    };
  }

  /**
   * Resets all in-flight trackers (primarily for test cleanup).
   */
  public reset(): void {
    for (const record of this.calls.values()) {
      if (record.timer) {
        clearTimeout(record.timer);
      }
    }
    this.calls.clear();
    this.updateInflightGauge();
  }
}

export const singleFlight = new SingleFlightGroup();
