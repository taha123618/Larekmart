import type { Redis } from "ioredis";
import {
  checkRedisConnection,
  closeRedisClient,
  createRedisClient,
} from "./client.js";
import { createKeyBuilder } from "./key-builder.js";
import type { KeyBuilder } from "./key-builder.js";
import type { RedisLogger } from "./types.js";

/**
 * Options for `createRedisService`.
 *
 * `url` and `keyPrefix` are required: every service must state which Redis it
 * talks to and which namespace its keys live in, so a misconfigured service
 * cannot write into another one's keyspace.
 */
export interface RedisServiceOptions {
  /** Full Redis connection URL, e.g. `"redis://localhost:6379"`. */
  url: string;
  /**
   * Service key namespace, e.g. `"product:v1:"`. A missing trailing `":"` is
   * added automatically.
   */
  keyPrefix: string;
  /** Service / caller name used in log messages, e.g. `"product-service"`. */
  serviceName: string;
  /** Optional structured logger; falls back to `console`. */
  logger?: RedisLogger;
  /** Maximum reconnect attempts before giving up. Defaults to 5. */
  maxRetries?: number;
  /** Maximum backoff delay in ms between reconnect attempts. Defaults to 2000. */
  maxRetryDelayMs?: number;
}

/**
 * Everything a service needs from Redis, in one object.
 */
export interface RedisService {
  /** The underlying ioredis client, for the package helpers or raw commands. */
  readonly client: Redis;
  /** Key builder bound to this service's prefix. */
  readonly keys: KeyBuilder;
  /** PING probe; never throws. */
  ping(): Promise<boolean>;
  /** Gracefully closes this service's connection. */
  close(): Promise<void>;
}

/**
 * Creates the Redis handle for one service: connection, namespaced key builder,
 * health probe, and shutdown, all bound to the same URL and prefix.
 *
 * This is the intended entry point for services — it means a service only
 * declares its configuration instead of repeating the singleton wiring:
 *
 * ```ts
 * // src/utils/redis.ts
 * export const redis = createRedisService({
 *   url: config.redis.url,
 *   keyPrefix: config.redis.keyPrefix,
 *   serviceName: "product-service",
 *   logger,
 * });
 * ```
 *
 * Consumers then use `redis.client` with the cache helpers, `redis.keys` to
 * build keys, `redis.ping()` for health checks, and `redis.close()` on shutdown.
 *
 * The connection is created eagerly (ioredis starts connecting immediately) and
 * is shared per URL within the process, so calling this twice with the same URL
 * reuses one connection.
 */
export function createRedisService(options: RedisServiceOptions): RedisService {
  const { url, keyPrefix, serviceName, logger, maxRetries, maxRetryDelayMs } =
    options;

  const client = createRedisClient(
    { url, serviceName, maxRetries, maxRetryDelayMs },
    logger,
  );

  return {
    client,
    keys: createKeyBuilder(keyPrefix),
    ping: () => checkRedisConnection(client),
    close: () => closeRedisClient(url, logger),
  };
}
