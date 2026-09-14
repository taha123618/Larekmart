/**
 * Read-through cache for the analytics HTTP API.
 *
 * Metrics change on every incoming Kafka event, so these entries are
 * **TTL-bounded rather than invalidated on write**: bumping a namespace version
 * per event would invalidate entries faster than the admin dashboard reads them
 * and the hit rate would collapse to zero. Bounded staleness of a few seconds is
 * the tradeoff a dashboard tolerates, and it is what keeps repeated polls of
 * `/analytics/daily-chart` and `/analytics/events` off PostgreSQL.
 *
 * Every call is best-effort: `cacheRead` reports an unreachable Redis instead of
 * throwing, so callers always fall through to the database. Outcomes are
 * classified by `@repo/monitoring`'s `cacheMetrics.record` — hits, misses, and
 * **Redis errors counted separately** (`cache_type` labels `daily-chart`,
 * `events`) — and surface at `GET /metrics` as `cache_hits_total`,
 * `cache_misses_total`, and `cache_errors_total`.
 */
import { cacheRead, cacheSet } from "@repo/redis";
import { redis } from "../utils/redis.js";
import { cacheMetrics } from "../observability/metrics.js";
import type { AnalyticsDailyChartType, AnalyticsEventType } from "@repo/types";

/** Parses a positive integer env value, falling back when unset or invalid. */
function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/** Daily aggregates move slowly; a minute of staleness is invisible on a chart. */
const DAILY_CHART_TTL_SECONDS = positiveInt(
  process.env.ANALYTICS_CHART_CACHE_TTL_SECONDS,
  60,
);

/** The audit stream is near-real-time, so it gets a much shorter window. */
const EVENTS_TTL_SECONDS = positiveInt(
  process.env.ANALYTICS_EVENTS_CACHE_TTL_SECONDS,
  15,
);

/** Cached daily aggregation rows for the requested window. */
export async function getCachedDailyChart(
  days: number,
): Promise<AnalyticsDailyChartType[] | null> {
  return cacheMetrics.record(
    await cacheRead<AnalyticsDailyChartType[]>(
      redis.client,
      redis.keys.namespace("daily-chart", days),
    ),
    "daily-chart",
  );
}

/** Stores daily aggregation rows for the requested window. */
export async function setCachedDailyChart(
  days: number,
  data: AnalyticsDailyChartType[],
): Promise<void> {
  await cacheSet(
    redis.client,
    redis.keys.namespace("daily-chart", days),
    data,
    DAILY_CHART_TTL_SECONDS,
  );
}

/** Cached recent audit events for the requested page size. */
export async function getCachedEvents(
  limit: number,
): Promise<AnalyticsEventType[] | null> {
  return cacheMetrics.record(
    await cacheRead<AnalyticsEventType[]>(
      redis.client,
      redis.keys.namespace("events", limit),
    ),
    "events",
  );
}

/** Stores recent audit events for the requested page size. */
export async function setCachedEvents(
  limit: number,
  data: AnalyticsEventType[],
): Promise<void> {
  await cacheSet(
    redis.client,
    redis.keys.namespace("events", limit),
    data,
    EVENTS_TTL_SECONDS,
  );
}
