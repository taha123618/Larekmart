import { Kafka } from "kafkajs";
import path from "node:path";
import { createRequire } from "node:module";

if (
  typeof process !== "undefined" &&
  process.env &&
  !process.env.KAFKAJS_NO_PARTITIONER_WARNING
) {
  process.env.KAFKAJS_NO_PARTITIONER_WARNING = "1";
}

// KafkaJS bugfix for Node 20+: Prevent negative timeout in RequestQueue.scheduleCheckPendingRequests
// which causes Node.js TimeoutNegativeWarning and [RequestQueue] Response without match race conditions.
let safeSocketFactory: (() => (options: any) => any) | undefined;

try {
  const req = typeof require !== "undefined" ? require : createRequire(import.meta.url);
  const kafkajsMain = req.resolve("kafkajs");
  const rqPath = path.join(path.dirname(kafkajsMain), "src/network/requestQueue/index.js");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const RequestQueue = req(rqPath);
  if (RequestQueue?.prototype?.scheduleCheckPendingRequests) {
    RequestQueue.prototype.scheduleCheckPendingRequests = function () {
      const scheduleAt = (this.throttledUntil || 0) - Date.now();
      if ((!this.pending || this.pending.length === 0) && scheduleAt <= 0) {
        return;
      }
      if (!this.throttleCheckTimeoutId) {
        const timeoutMs = scheduleAt > 0 ? scheduleAt : 100;
        this.throttleCheckTimeoutId = setTimeout(() => {
          this.throttleCheckTimeoutId = null;
          this.checkPendingRequests();
        }, timeoutMs);
      }
    };
  }

  // KafkaJS bugfix for Node 20+: Guard socket.write against ERR_STREAM_WRITE_AFTER_END
  // when brokers close idle/rebalance connections while requests are queued.
  const sfPath = path.join(path.dirname(kafkajsMain), "src/network/socketFactory.js");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const originalFactoryModule = req(sfPath);
  if (typeof originalFactoryModule === "function" && !(originalFactoryModule as any)._isPatched) {
    safeSocketFactory = function () {
      const rawFactory = originalFactoryModule();
      return function (options: any) {
        const socket = rawFactory(options);
        const originalWrite = socket.write;
        socket.write = function (this: any, chunk: any, encoding: any, cb: any) {
          if (this.destroyed || this.writableEnded || !this.writable) {
            if (typeof encoding === "function") encoding();
            else if (typeof cb === "function") cb();
            return false;
          }
          try {
            return originalWrite.apply(this, arguments as any);
          } catch (err: any) {
            if (
              err &&
              (err.code === "ERR_STREAM_WRITE_AFTER_END" ||
                err.message?.includes("write after end"))
            ) {
              return false;
            }
            throw err;
          }
        };
        return socket;
      };
    };
    (safeSocketFactory as any)._isPatched = true;
    if (req.cache && req.cache[sfPath]) {
      req.cache[sfPath].exports = safeSocketFactory;
    }
  }
} catch {
  // Fail-open if internal KafkaJS module layout changes
}

/**
 * Broker addresses, in order of preference:
 * 1. `KAFKA_BROKERS` env var (comma-separated) — used by services that
 *    configure custom or single brokers.
 * 2. The three local development brokers bound to 127.0.0.1 (see
 *    packages/kafka/AGENTS.md).
 */
function resolveBrokers(brokers?: string[] | string): string[] {
  if (Array.isArray(brokers) && brokers.length > 0) {
    return brokers.map((b) => b.trim()).filter((b) => b.length > 0);
  }
  if (typeof brokers === "string" && brokers.trim().length > 0) {
    return brokers
      .split(",")
      .map((b) => b.trim())
      .filter((b) => b.length > 0);
  }

  return ["localhost:9094", "localhost:9095", "localhost:9096"];
}

export interface KafkaClientCustomOptions {
  connectionTimeout?: number;
  requestTimeout?: number;
}

export const createKafkaClient = (
  service: string,
  brokers?: string[] | string,
  options?: KafkaClientCustomOptions,
) => {
  const connectionTimeout =
    options?.connectionTimeout ??
    (process.env.KAFKA_CONNECTION_TIMEOUT
      ? Number(process.env.KAFKA_CONNECTION_TIMEOUT)
      : 10_000);

  const requestTimeout =
    options?.requestTimeout ??
    (process.env.KAFKA_REQUEST_TIMEOUT
      ? Number(process.env.KAFKA_REQUEST_TIMEOUT)
      : 30_000);

  return new Kafka({
    clientId: service,
    brokers: resolveBrokers(brokers),
    connectionTimeout,
    requestTimeout,
    retry: {
      initialRetryTime: 300,
      maxRetryTime: 30_000,
      retries: 8,
    },
    ...(safeSocketFactory ? { socketFactory: safeSocketFactory() } : {}),
  });
};
