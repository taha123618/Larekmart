/**
 * Cache statistics for the services that cache through `@repo/redis`.
 *
 * Every service exposes its counters in Prometheus text format at `GET /metrics`
 * (`cache_hits_total` / `cache_misses_total` / `cache_errors_total`, labelled by
 * `cache_type`). This module scrapes and shapes that text for the dashboard —
 * the admin app never talks to Redis itself.
 *
 * Errors are tracked separately from misses on purpose: a read that failed
 * because Redis was unreachable is not evidence that the cache was cold, and
 * folding the two together would show an outage as a 0% hit rate. For the same
 * reason the error rate is reported alongside the hit rate rather than mixed
 * into it, and it is the ratio to watch when comparing services: a service with
 * a 0% error rate is healthy whatever its hit rate, while a non-zero error rate
 * means its cache is unreachable some of the time.
 *
 * `/metrics` is public on each service, but the Clerk token is sent anyway to
 * match how every other backend call from this app is made.
 */

export interface CacheTypeStats {
  /** The `cache_type` label, e.g. `products` or `daily-chart`. */
  cacheType: string;
  hits: number;
  misses: number;
  /** Reads that failed because Redis was unreachable. */
  errors: number;
}

export interface ServiceCacheStats {
  service: string;
  url: string;
  /** False when `/metrics` could not be read; see `error`. */
  reachable: boolean;
  error?: string;
  hits: number;
  misses: number;
  /** Reads that failed because Redis was unreachable — not misses. */
  errors: number;
  /** `hits / (hits + misses)`, or `null` when no traffic has been recorded. */
  hitRate: number | null;
  /**
   * `errors / (hits + misses + errors)`, or `null` when nothing has been read.
   * `0` is healthy; anything else means Redis was unreachable for this service.
   */
  errorRate: number | null;
  types: CacheTypeStats[];
}

export interface CacheServiceTarget {
  service: string;
  url: string;
}

/**
 * Services with cache counters to report. Order and URLs mirror the env vars the
 * rest of the app uses, with the same localhost fallbacks so the page works
 * before `.env` is filled in.
 */
export function getCacheServiceTargets(): CacheServiceTarget[] {
  return [
    {
      service: "search-service",
      url:
        process.env.NEXT_PUBLIC_SEARCH_SERVICE_URL ?? "http://localhost:8006",
    },
    {
      service: "product-service",
      url:
        process.env.NEXT_PUBLIC_PRODUCT_SERVICE_URL ?? "http://localhost:8000",
    },
    {
      service: "analytic-service",
      url:
        process.env.NEXT_PUBLIC_ANALYTIC_SERVICE_URL ?? "http://localhost:8004",
    },
    {
      service: "order-service",
      url: process.env.NEXT_PUBLIC_ORDER_SERVICE_URL ?? "http://localhost:8001",
    },
    {
      service: "inventory-service",
      url:
        process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL ??
        "http://localhost:8007",
    },
    {
      service: "recommendation-service",
      url:
        process.env.NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL ??
        "http://localhost:8008",
    },
  ];
}

/**
 * Matches one exposition line, e.g.
 *   cache_hits_total{cache_type="products"} 42
 *   cache_errors_total 3
 */
const CACHE_METRIC_LINE =
  /^(cache_hits_total|cache_misses_total|cache_errors_total|recommendation_cache_hits_total|recommendation_cache_misses_total)(?:\{(.*)\})?\s+(\S+)$/;

/** Reads a label value out of a Prometheus label string. */
function readLabel(labels: string, name: string): string | undefined {
  const match = new RegExp(`${name}="([^"]*)"`).exec(labels);
  return match?.[1];
}

/**
 * Share of cacheable reads that were served from Redis: `hits / (hits +
 * misses)`. `null` when no read has been served yet.
 *
 * Errored reads are excluded from the denominator — they say nothing about how
 * good the cache is, only that Redis was unavailable.
 */
export function hitRateOf(hits: number, misses: number): number | null {
  const total = hits + misses;
  return total === 0 ? null : hits / total;
}

/**
 * Share of **all** read attempts that failed because Redis was unreachable:
 * `errors / (hits + misses + errors)`. `null` when nothing has been read yet.
 *
 * This is the rate to compare services on. A hit rate can be low for benign
 * reasons (a cold cache, a high-cardinality key space), but any non-zero error
 * rate means that service saw Redis down, so `0%` is the only healthy value.
 */
export function errorRateOf(
  hits: number,
  misses: number,
  errors: number,
): number | null {
  const attempts = hits + misses + errors;
  return attempts === 0 ? null : errors / attempts;
}

/**
 * Orders services so the highest Redis error rate comes first — the service
 * whose cache is actually failing should be the first thing on the page rather
 * than something you have to hunt for.
 *
 * A `null` rate (no traffic yet, or `/metrics` unreadable) sorts below every
 * real rate: it is not `0%`, but it is also not evidence of a problem, and a
 * service that simply is not running locally would otherwise crowd out the
 * signal. Ties keep their configured order — `Array.prototype.sort` is stable
 * per spec, so returning `0` preserves it rather than shuffling.
 */
export function rankByErrorRate(
  stats: ServiceCacheStats[],
): ServiceCacheStats[] {
  return [...stats].sort((a, b) => {
    if (a.errorRate === null) return b.errorRate === null ? 0 : 1;
    if (b.errorRate === null) return -1;
    return b.errorRate - a.errorRate;
  });
}

/**
 * Extracts cache counters from a Prometheus exposition payload.
 *
 * Totals sum across label sets, so a service with several `cache_type` values
 * reports one overall rate plus a per-type breakdown.
 */
export function parseCacheMetrics(text: string): {
  hits: number;
  misses: number;
  errors: number;
  types: CacheTypeStats[];
} {
  const byType = new Map<string, CacheTypeStats>();
  let hits = 0;
  let misses = 0;
  let errors = 0;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = CACHE_METRIC_LINE.exec(trimmed);
    if (!match) continue;

    const name = match[1];
    const value = Number(match[3]);
    if (!name || !Number.isFinite(value)) continue;

    const cacheType = readLabel(match[2] ?? "", "cache_type") ?? "unlabelled";
    const bucket = byType.get(cacheType) ?? {
      cacheType,
      hits: 0,
      misses: 0,
      errors: 0,
    };

    if (
      name === "cache_hits_total" ||
      name === "recommendation_cache_hits_total"
    ) {
      bucket.hits += value;
      hits += value;
    } else if (name === "cache_errors_total") {
      bucket.errors += value;
      errors += value;
    } else {
      bucket.misses += value;
      misses += value;
    }

    byType.set(cacheType, bucket);
  }

  const types = [...byType.values()].sort((a, b) =>
    a.cacheType.localeCompare(b.cacheType),
  );

  return { hits, misses, errors, types };
}

/**
 * Scrapes one service's `/metrics` and returns its cache statistics. A service
 * that is down or does not expose the counters reports `reachable: false` rather
 * than failing the whole dashboard.
 */
export async function readServiceCacheStats(
  target: CacheServiceTarget,
  token: string | null,
): Promise<ServiceCacheStats> {
  const unreachable = (error: string): ServiceCacheStats => ({
    ...target,
    reachable: false,
    error,
    hits: 0,
    misses: 0,
    errors: 0,
    hitRate: null,
    errorRate: null,
    types: [],
  });

  try {
    const response = await fetch(`${target.url}/metrics`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      return unreachable(`HTTP ${response.status}`);
    }

    const { hits, misses, errors, types } = parseCacheMetrics(
      await response.text(),
    );

    return {
      ...target,
      reachable: true,
      hits,
      misses,
      errors,
      hitRate: hitRateOf(hits, misses),
      errorRate: errorRateOf(hits, misses, errors),
      types,
    };
  } catch (error) {
    // Node wraps connection failures as "fetch failed"; the cause names the
    // address, which is what is actually useful in the dashboard.
    const message =
      error instanceof Error
        ? error.cause instanceof Error
          ? error.cause.message
          : error.message
        : String(error);
    return unreachable(message);
  }
}
