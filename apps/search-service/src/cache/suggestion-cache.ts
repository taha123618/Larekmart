import { getRedisClient } from "../utils/redis.js";
import { config } from "../config/config.js";
import { logger, searchMetrics } from "../observability/metrics.js";
import type { SuggestionQuery, SuggestionResponse } from "@repo/types";

export function generateSuggestionKey(params: SuggestionQuery): string {
  const queryNormalized = params.q.trim().toLowerCase();
  return `${config.redis.keyPrefix}sugg:${queryNormalized}:${params.limit}`;
}

export async function getCachedSuggestions(params: SuggestionQuery): Promise<SuggestionResponse | null> {
  try {
    const redis = getRedisClient();
    const key = generateSuggestionKey(params);
    const data = await redis.get(key);

    if (!data) {
      searchMetrics.cacheMissesTotal.inc({ cache_type: "suggestion" });
      return null;
    }

    searchMetrics.cacheHitsTotal.inc({ cache_type: "suggestion" });
    const parsed: SuggestionResponse = JSON.parse(data);
    parsed.fromCache = true;
    return parsed;
  } catch (error) {
    searchMetrics.cacheMissesTotal.inc({ cache_type: "suggestion" });
    return null;
  }
}

export async function setCachedSuggestions(
  params: SuggestionQuery,
  response: SuggestionResponse,
  ttlSeconds: number = config.redis.suggestionCacheTtl,
): Promise<void> {
  try {
    const redis = getRedisClient();
    const key = generateSuggestionKey(params);
    await redis.setex(key, ttlSeconds, JSON.stringify(response));
  } catch (error) {
    logger.warn("Failed to set suggestions cache in Redis", { error });
  }
}
