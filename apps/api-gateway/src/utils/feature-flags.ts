/**
 * Dynamic Feature Flagging Handle for API Gateway
 *
 * Backed by `@repo/redis` with OpenFeature-compatible evaluation semantics,
 * sub-millisecond local caching, and distributed pub/sub cache invalidation.
 */

import { createFeatureFlagEngine, type FeatureFlagEngine } from "@repo/redis";
import { redis } from "./redis.js";
import { logger } from "../observability/logger.js";

export const featureFlagEngine: FeatureFlagEngine = createFeatureFlagEngine({
  redis: redis.client,
  keyPrefix: "ff:global:",
  cacheTtlMs: 15_000,
  logger,
});
