import { createHash } from "node:crypto";
import {
  cacheRead,
  cacheSet,
  cacheDel,
  type CacheReadResult,
} from "@repo/redis";
import { cacheMetrics } from "../observability/metrics.js";
import { mediaCacheTtlSeconds, redis } from "../utils/redis.js";

/**
 * Media metadata + resolve cache (spec section 19).
 *
 * Redis is a cache only — never the source of truth. Reads go through
 * `@repo/redis`'s `cacheRead`, which reports hit/miss/error; misses and
 * errors feed `cacheMetrics` so the standard `cache_hits_total` /
 * `cache_misses_total` / `cache_errors_total` counters (labelled
 * `cache_type`) stay consistent with every other service and the admin
 * Cache Performance page can scrape them like any other service's.
 *
 * Key layout (namespaced by the `media:v1:` prefix from the Redis handle):
 *   media:v1:media:<mediaId>             → resolved URL (string) for one media
 *   media:v1:resolve:<sha1(sortedRefs)>  → batch resolve map for a ref list
 *   media:v1:completed:<mediaId>         → upload-completion idempotency marker
 *
 * Negative caching: a media that is not READY (or not visible) resolves to
 * the sentinel string `"-"`. `cacheRead` treats a stored literal `null` as a
 * miss, so the sentinel is what makes negative entries cacheable — without
 * it, every storefront page view containing an unprocessed media id would
 * hit PostgreSQL until processing finishes.
 */

const NEGATIVE = "-";

/** Stable cache key for an arbitrary list of media references. */
export function resolveKeyFor(refs: string[]): string {
  const sorted = [...refs].sort();
  // SHA-1 of sorted refs — not a security boundary, just batch dedup.
  return createHash("sha1").update(sorted.join("\n")).digest("hex");
}

/**
 * Reads one cached URL. Negative entries surface as `hit` + `null` — the
 * caller learns "definitely unresolvable" without touching PostgreSQL.
 */
export async function readMediaUrl(
  mediaId: string,
): Promise<CacheReadResult<string | null>> {
  const result = await cacheRead<string>(
    redis.client,
    redis.keys.namespace("media", mediaId),
  );
  if (result.status === "hit" && result.value === NEGATIVE) {
    // We did avoid the DB — count the negative entry as a hit.
    return { status: "hit", value: null };
  }
  return result;
}

/** Writes a URL (or negative sentinel) for one media id with TTL. */
export async function writeMediaUrl(
  mediaId: string,
  url: string | null,
): Promise<void> {
  await cacheSet(
    redis.client,
    redis.keys.namespace("media", mediaId),
    url ?? NEGATIVE,
    mediaCacheTtlSeconds,
  );
}

/** Reads a cached batch resolve map for a ref list. */
export async function readResolveBatch(
  refs: string[],
): Promise<CacheReadResult<Record<string, string | null>>> {
  const result = await cacheRead<Record<string, string | null>>(
    redis.client,
    redis.keys.namespace("resolve", resolveKeyFor(refs)),
  );
  cacheMetrics.record(
    {
      status: result.status,
      value: result.status === "hit" ? result.value : null,
    },
    "media_resolve",
  );
  return result;
}

/** Writes a batch resolve map with TTL. */
export async function writeResolveBatch(
  refs: string[],
  items: Record<string, string | null>,
): Promise<void> {
  await cacheSet(
    redis.client,
    redis.keys.namespace("resolve", resolveKeyFor(refs)),
    items,
    mediaCacheTtlSeconds,
  );
}

/** Reads the single-media metadata cache (used by GET /media/:id). */
export async function readMediaMetadata(
  mediaId: string,
): Promise<CacheReadResult<unknown>> {
  const result = await cacheRead<unknown>(
    redis.client,
    redis.keys.namespace("media", mediaId),
  );
  cacheMetrics.record(
    {
      status: result.status,
      value: result.status === "hit" ? result.value : null,
    },
    "media_metadata",
  );
  return result;
}

/**
 * Invalidates every cached representation of one media. Called after any
 * lifecycle transition that changes a resolved URL or metadata: READY
 * transitions, quarantine, soft delete/restore, owner reassignment, and
 * variant writes.
 */
export async function invalidateMedia(mediaId: string): Promise<void> {
  await cacheDel(redis.client, redis.keys.namespace("media", mediaId));
  // Batch resolve entries embed the refs list rather than the media id, so
  // they cannot be targeted individually; they are TTL-bounded (short) and
  // self-heal on the next read after expiry.
}

/** Cache TTL in seconds (from validated env). */
export { mediaCacheTtlSeconds };
