/**
 * Read-through cache for the 6-month order-chart aggregation.
 *
 * The aggregation scans every order in a six-month window on each dashboard
 * load, and orders are created continuously, so this entry is **TTL-bounded
 * rather than invalidated on write**: bumping a version per order would
 * invalidate the entry faster than the dashboard reads it (a near-zero hit
 * rate), while a short TTL keeps the chart fresh enough for an operations
 * dashboard. Match the analytic-service dashboards here.
 *
 * Every call is best-effort: `cacheRead` reports an unreachable Redis instead of
 * throwing, so the route always falls through to MongoDB. Outcomes are
 * classified by `@repo/monitoring`'s `cacheMetrics.record` — hits, misses, and
 * **Redis errors counted separately** (`cache_type: "order-chart"`) — and
 * surface at `GET /metrics` as `cache_hits_total`, `cache_misses_total`, and
 * `cache_errors_total`.
 */
import { cacheRead, cacheSet } from "@repo/redis";
import type { OrderChartType } from "@repo/types";
import { redis } from "../utils/redis.js";
import { cacheMetrics } from "../observability/metrics.js";

/** Parses a positive integer env value, falling back when unset or invalid. */
function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/** One chart covers six months; a minute of staleness is invisible on it. */
const ORDER_CHART_TTL_SECONDS = positiveInt(
  process.env.ORDER_CHART_CACHE_TTL_SECONDS,
  60,
);

const CACHE_TYPE = "order-chart";

/** Returns the cached order chart, or `null` on miss/error. */
export async function getCachedOrderChart(): Promise<OrderChartType[] | null> {
  return cacheMetrics.record(
    await cacheRead<OrderChartType[]>(
      redis.client,
      redis.keys.simple(CACHE_TYPE),
    ),
    CACHE_TYPE,
  );
}

/** Caches the order chart for the configured TTL. */
export async function setCachedOrderChart(
  chart: OrderChartType[],
): Promise<void> {
  await cacheSet(
    redis.client,
    redis.keys.simple(CACHE_TYPE),
    chart,
    ORDER_CHART_TTL_SECONDS,
  );
}
