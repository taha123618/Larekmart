import type {
  HealthCheckFn,
  HealthCheckResult,
  HealthStatus,
  RegisteredHealthCheck,
  ServiceHealthReport,
} from "./types.js";

const startTime = Date.now();

export class HealthRegistry {
  public readonly serviceName: string;
  public readonly version?: string;
  private checks: Map<string, RegisteredHealthCheck> = new Map();

  constructor(serviceName: string, version?: string) {
    this.serviceName = serviceName;
    this.version = version;
  }

  /**
   * Register a new health check with the registry.
   */
  public register(
    name: string,
    check: HealthCheckFn,
    options: { critical?: boolean; timeoutMs?: number } = {},
  ): this {
    this.checks.set(name, {
      name,
      check,
      critical: options.critical ?? true,
      timeoutMs: options.timeoutMs ?? 5000,
    });
    return this;
  }

  /**
   * Unregister a health check by name.
   */
  public unregister(name: string): boolean {
    return this.checks.delete(name);
  }

  /**
   * Runs all registered health checks concurrently and aggregates the health status.
   */
  public async runChecks(): Promise<ServiceHealthReport> {
    const results: Record<string, HealthCheckResult> = {};
    const checkPromises = Array.from(this.checks.values()).map(
      async (regCheck) => {
        const checkStart = Date.now();
        try {
          const timeoutPromise = new Promise<HealthCheckResult>((_, reject) => {
            setTimeout(
              () =>
                reject(
                  new Error(
                    `Health check timed out after ${regCheck.timeoutMs}ms`,
                  ),
                ),
              regCheck.timeoutMs,
            );
          });

          const checkPromise = Promise.resolve().then(() => regCheck.check());
          const res = await Promise.race([checkPromise, timeoutPromise]);

          results[regCheck.name] = {
            status: res.status,
            latencyMs: res.latencyMs ?? Date.now() - checkStart,
            message: res.message,
            timestamp: res.timestamp || new Date().toISOString(),
            details: res.details,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results[regCheck.name] = {
            status: "unhealthy",
            latencyMs: Date.now() - checkStart,
            message,
            timestamp: new Date().toISOString(),
          };
        }
      },
    );

    await Promise.all(checkPromises);

    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;
    let overallStatus: HealthStatus = "healthy";

    for (const [name, result] of Object.entries(results)) {
      const reg = this.checks.get(name);
      if (result.status === "healthy") {
        healthyCount++;
      } else if (result.status === "degraded") {
        degradedCount++;
        if (overallStatus !== "unhealthy") {
          overallStatus = "degraded";
        }
      } else {
        unhealthyCount++;
        if (reg?.critical) {
          overallStatus = "unhealthy";
        } else if (overallStatus !== "unhealthy") {
          overallStatus = "degraded";
        }
      }
    }

    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    return {
      service: this.serviceName,
      status: overallStatus,
      uptimeSeconds,
      timestamp: new Date().toISOString(),
      ...(this.version && { version: this.version }),
      checks: results,
      summary: {
        total: this.checks.size,
        healthy: healthyCount,
        degraded: degradedCount,
        unhealthy: unhealthyCount,
      },
    };
  }
}

/**
 * Creates a memory threshold health check.
 */
export function createMemoryCheck(
  maxHeapBytes: number = 1024 * 1024 * 1024,
): HealthCheckFn {
  return () => {
    const memory = process.memoryUsage();
    const heapUsed = memory.heapUsed;
    const isDegraded = heapUsed > maxHeapBytes * 0.85;
    const isUnhealthy = heapUsed > maxHeapBytes;

    const status: HealthStatus = isUnhealthy
      ? "unhealthy"
      : isDegraded
        ? "degraded"
        : "healthy";
    return {
      status,
      latencyMs: 0,
      timestamp: new Date().toISOString(),
      message: `Heap: ${(heapUsed / (1024 * 1024)).toFixed(2)} MB / ${(maxHeapBytes / (1024 * 1024)).toFixed(2)} MB`,
      details: {
        heapUsedBytes: heapUsed,
        heapTotalBytes: memory.heapTotal,
        rssBytes: memory.rss,
      },
    };
  };
}

/**
 * Creates a generic database / storage ping health check.
 */
export function createDbCheck(
  name: string,
  pingFn: () => Promise<unknown>,
): HealthCheckFn {
  return async () => {
    const start = Date.now();
    try {
      await pingFn();
      const latencyMs = Date.now() - start;
      return {
        status: latencyMs > 2000 ? "degraded" : "healthy",
        latencyMs,
        timestamp: new Date().toISOString(),
        message: `${name} ping successful (${latencyMs}ms)`,
      };
    } catch (err) {
      return {
        status: "unhealthy",
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        message: `${name} ping failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  };
}

/**
 * Creates a generic HTTP ping health check.
 */
export function createHttpPingCheck(
  url: string,
  timeoutMs: number = 3000,
): HealthCheckFn {
  return async () => {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - start;
      if (res.ok) {
        return {
          status: latencyMs > 1500 ? "degraded" : "healthy",
          latencyMs,
          timestamp: new Date().toISOString(),
          message: `HTTP ${res.status} OK`,
        };
      }
      return {
        status: "degraded",
        latencyMs,
        timestamp: new Date().toISOString(),
        message: `HTTP check returned status ${res.status}`,
      };
    } catch (err) {
      return {
        status: "unhealthy",
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        message: `HTTP ping failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  };
}

/**
 * Creates a HealthRegistry instance for a service.
 */
export function createHealthRegistry(
  serviceName: string,
  version?: string,
): HealthRegistry {
  return new HealthRegistry(serviceName, version);
}
