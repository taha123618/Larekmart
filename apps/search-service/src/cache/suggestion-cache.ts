import { cacheGet, cacheSet } from "@repo/redis";
import { getRedisClient } from "../utils/redis.js";
import { config } from "../config/config.js";
import { searchMetrics } from "../observability/metrics.js";
import type { SuggestionQuery, SuggestionResponse } from "@repo/types";

/**
 * Generates a deterministic cache key for suggestion queries.
 * The query is normalised (trimmed + lower-cased) so minor case differences
 * don't produce separate cache entries.
 */
export function generateSuggestionKey(params: SuggestionQuery): string {
  const queryNormalized = params.q.trim().toLowerCase();
  return `${config.redis.keyPrefix}sugg:${queryNormalized}:${params.limit}`;
}

/** Returns cached suggestions for `params`, or `null` on miss. */
export async function getCachedSuggestions(
  params: SuggestionQuery,
): Promise<SuggestionResponse | null> {
  const key = generateSuggestionKey(params);
  const cached = await cacheGet<SuggestionResponse>(getRedisClient(), key);

  if (!cached) {
    searchMetrics.cacheMissesTotal.inc({ cache_type: "suggestion" });
    return null;
  }

  searchMetrics.cacheHitsTotal.inc({ cache_type: "suggestion" });
  cached.fromCache = true;
  return cached;
}

/** Writes suggestion results to Redis with the configured TTL. */
export async function setCachedSuggestions(
  params: SuggestionQuery,
  response: SuggestionResponse,
  ttlSeconds: number = config.redis.suggestionCacheTtl,
): Promise<void> {
  const key = generateSuggestionKey(params);
  await cacheSet(getRedisClient(), key, response, ttlSeconds);
}
