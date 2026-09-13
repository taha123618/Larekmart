import { Redis } from "ioredis";
import type { RedisClientConfig, RedisLogger } from "./types.js";

/**
 * Per-process singleton map so each unique URL gets exactly one connection.
 * Services that need separate logical databases should pass different URLs.
 */
const clients = new Map<string, Redis>();

/**
 * Creates (or returns an existing) ioredis client for the given `url`.
 *
 * Behaviour:
 * - **Lazy connect** is disabled — the client begins connecting immediately.
 * - Event listeners surface errors as warnings so they never crash the process.
 * - Exponential backoff capped at `maxRetryDelayMs` (default 2 s).
 * - After `maxRetries` attempts (default 5) the retry strategy returns null,
 *   which causes ioredis to stop retrying; the process keeps running.
 *
 * @param config  - Connection options.
 * @param logger  - Optional structured logger; falls back to `console`.
 */
export function createRedisClient(
  config: RedisClientConfig,
  logger?: RedisLogger,
): Redis {
  const existing = clients.get(config.url);
  if (existing) return existing;

  const log = logger ?? console;
  const maxRetries = config.maxRetries ?? 5;
  const maxDelay = config.maxRetryDelayMs ?? 2000;
  const prefix = config.serviceName ? `[${config.serviceName}] ` : "";

  const client = new Redis(config.url, {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    retryStrategy(times: number) {
      if (times > maxRetries) {
        log.warn(`${prefix}Redis retry limit (${maxRetries}) reached; backing off permanently`, {
          url: config.url,
          attempts: times,
        });
        return null; // stop retrying
      }
      const delay = Math.min(times * 100, maxDelay);
      log.warn(`${prefix}Redis reconnecting in ${delay}ms`, { attempt: times });
      return delay;
    },
  });

  client.on("connect", () => {
    log.info(`${prefix}Redis connected`, { url: config.url });
  });

  client.on("ready", () => {
    log.info(`${prefix}Redis client ready`);
  });

  client.on("error", (err: Error) => {
    log.warn(`${prefix}Redis error (service continues in degraded mode)`, {
      error: err.message,
    });
  });

  client.on("close", () => {
    log.warn(`${prefix}Redis connection closed`);
  });

  client.on("reconnecting", (delay: number) => {
    log.warn(`${prefix}Redis reconnecting`, { delayMs: delay });
  });

  clients.set(config.url, client);
  return client;
}

/**
 * Gracefully quits the Redis client for the given URL and removes it from
 * the internal singleton map.  Safe to call even if the client was never created.
 *
 * @param url     - The same URL passed to `createRedisClient`.
 * @param logger  - Optional structured logger.
 */
export async function closeRedisClient(
  url: string,
  logger?: RedisLogger,
): Promise<void> {
  const client = clients.get(url);
  if (!client) return;

  const log = logger ?? console;

  try {
    await client.quit();
    log.info("Redis client disconnected", { url });
  } catch (error) {
    log.error("Error disconnecting Redis client", {
      url,
      error: (error as Error).message,
    });
  } finally {
    clients.delete(url);
  }
}

/**
 * Closes all open Redis connections managed by this package.
 * Useful for graceful shutdown when multiple clients are active.
 */
export async function closeAllRedisClients(logger?: RedisLogger): Promise<void> {
  const log = logger ?? console;
  const urls = [...clients.keys()];

  await Promise.allSettled(
    urls.map(async (url) => {
      try {
        await clients.get(url)!.quit();
        log.info("Redis client closed", { url });
      } catch (error) {
        log.error("Error closing Redis client", {
          url,
          error: (error as Error).message,
        });
      } finally {
        clients.delete(url);
      }
    }),
  );
}

/**
 * Sends a PING to the Redis server.  Returns `true` if the server responds
 * with PONG, `false` on any error.  Never throws.
 *
 * @param client  - An ioredis client instance (from `createRedisClient`).
 */
export async function checkRedisConnection(client: Redis): Promise<boolean> {
  try {
    const result = await client.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}
