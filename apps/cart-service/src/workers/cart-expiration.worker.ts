import os from "node:os";
import { randomUUID } from "node:crypto";
import { withClusterLock } from "@repo/redis";
import { redis } from "../utils/redis.js";
import { expirationService } from "../services/expiration.service.js";
import { logger } from "../observability/metrics.js";

const WORKER_ID = `${process.env.HOSTNAME || os.hostname() || "cart-worker"}:${process.pid}:${randomUUID().slice(0, 8)}`;
const CART_EXPIRATION_LEADER_KEY = "cart:expiration:sweeper:leader";

let workerInterval: NodeJS.Timeout | null = null;

export const startCartExpirationWorker = (intervalMs: number = 60000): void => {
  if (workerInterval) return;

  logger.info(
    "Starting cart expiration background worker with cluster leader lock",
    {
      intervalMs,
      workerId: WORKER_ID,
    },
  );
  workerInterval = setInterval(async () => {
    try {
      await withClusterLock(
        redis.client,
        CART_EXPIRATION_LEADER_KEY,
        WORKER_ID,
        async () => {
          await expirationService.reapExpiredCarts();
        },
        { ttlMs: Math.max(10000, intervalMs - 5000) },
      );
    } catch (err) {
      logger.error(
        "Unhandled error in cart expiration worker loop",
        err as Error,
      );
    }
  }, intervalMs);
};

export const stopCartExpirationWorker = (): void => {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    logger.info("Stopped cart expiration background worker");
  }
};
