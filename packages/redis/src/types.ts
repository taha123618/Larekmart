/**
 * Configuration accepted by `createRedisClient`.
 *
 * Note there is intentionally no `keyPrefix` option here: keys are composed by
 * the service with `createKeyBuilder`, which keeps this factory a plain
 * connection factory and makes every key a service writes greppable in one
 * place. See `packages/redis/AGENTS.md`.
 */
export interface RedisClientConfig {
  /**
   * Full Redis connection URL, e.g. "redis://localhost:6379".
   *
   * Use the path segment to pick a logical database when a service needs one:
   * `redis://localhost:6379/2`. Services should not share a database unless
   * they also share a key prefix.
   */
  url: string;
  /**
   * Maximum number of reconnect attempts before the client gives up.
   * Defaults to 5. Pass `Infinity` to retry forever.
   */
  maxRetries?: number;
  /**
   * Maximum backoff delay in ms between reconnect attempts. Defaults to 2000.
   */
  maxRetryDelayMs?: number;
  /**
   * Service / caller name used in log messages (e.g. "search-service").
   */
  serviceName?: string;
}

/**
 * A minimal structured logger interface compatible with @repo/monitoring's Logger
 * and with the built-in console object so callers can pass either.
 */
export interface RedisLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug?(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Options for the sliding-window rate limiter helper.
 */
export interface RateLimitOptions {
  /** Redis key for this rate-limit bucket. */
  key: string;
  /** Maximum allowed requests inside the window. */
  maxRequests: number;
  /** Window size in seconds. */
  windowSeconds: number;
}

/**
 * Result returned by `checkRateLimit`.
 */
export interface RateLimitResult {
  /** Whether the caller is within the allowed limit. */
  allowed: boolean;
  /** Current request count in the window (including this request). */
  current: number;
  /** Maximum requests allowed in the window. */
  limit: number;
  /** Remaining requests before the limit is hit. */
  remaining: number;
  /** Seconds until the window resets. */
  resetIn: number;
}
