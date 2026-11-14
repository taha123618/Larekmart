import os from "node:os";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/product-db";
import { withClusterLock } from "@repo/redis";
import { logger, outboxMetrics } from "../observability/metrics.js";
import { producer } from "../utils/kafka.js";
import { redis } from "../utils/redis.js";

export const OUTBOX_WORKER_ID = `${process.env.HOSTNAME || os.hostname() || "product-worker"}:${process.pid}:${randomUUID().slice(0, 8)}`;
export const OUTBOX_CLUSTER_LEADER_KEY = "product:outbox:sweeper:leader";
export const OUTBOX_LEADER_TTL_MS = 10_000;
export const OUTBOX_MAX_RETRIES = 5;

let isSweeping = false;
let lastRetentionPurge = 0;
const RETENTION_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RETENTION_RETENTION_DAYS = 7;

/**
 * Claims and processes a batch of PENDING outbox events with idempotency and retry handling.
 *
 * @param batchSize - Maximum number of pending records to fetch per sweep
 * @returns Number of successfully published events
 */
export async function processOutboxBatch(batchSize = 50): Promise<number> {
  const pendingCount = await prisma.outboxEvent.count({
    where: { status: "PENDING" },
  });
  outboxMetrics.pendingEvents.set(pendingCount);

  if (pendingCount === 0) {
    return 0;
  }

  const events = await prisma.outboxEvent.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  let publishedCount = 0;

  for (const event of events) {
    try {
      const payload = event.payload as Record<string, unknown>;
      const partitionKey =
        payload?.id ||
        payload?.productId ||
        payload?.slug ||
        event.id;

      await producer.send(
        event.topic,
        { value: event.payload },
        partitionKey ? { key: String(partitionKey) } : undefined,
      );

      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      outboxMetrics.publishedEvents.inc({ topic: event.topic });
      publishedCount++;
    } catch (err) {
      const nextRetry = event.retryCount + 1;
      const errorMessage = err instanceof Error ? err.message : String(err);

      logger.warn("Failed to publish product outbox event to Kafka", {
        eventId: event.id,
        topic: event.topic,
        retryCount: nextRetry,
        error: errorMessage,
      });

      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          retryCount: nextRetry,
          status: nextRetry >= OUTBOX_MAX_RETRIES ? "FAILED" : "PENDING",
          lastError: errorMessage,
        },
      });

      outboxMetrics.failedEvents.inc({ topic: event.topic });
    }
  }

  // Periodic sliding retention purge: delete PUBLISHED records older than 7 days
  const now = Date.now();
  if (now - lastRetentionPurge > RETENTION_PURGE_INTERVAL_MS) {
    lastRetentionPurge = now;
    try {
      const retentionThreshold = new Date(
        now - RETENTION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );
      const purged = await prisma.outboxEvent.deleteMany({
        where: {
          status: "PUBLISHED",
          publishedAt: { lt: retentionThreshold },
        },
      });
      if (purged.count > 0) {
        logger.info(
          `Purged ${purged.count} historical published outbox events (> ${RETENTION_RETENTION_DAYS}d old)`,
        );
      }
    } catch (purgeErr) {
      logger.warn("Failed to purge aged outbox events", { error: purgeErr });
    }
  }

  return publishedCount;
}

/**
 * Starts the distributed background relay sweeper.
 * Guarantees single-pod execution using Redis cluster leader locking.
 *
 * @param intervalMs - Polling interval in milliseconds (default: 5000ms)
 * @returns Teardown function to cleanly cancel interval
 */
export function startOutboxRelay(
  intervalMs = Number.parseInt(
    process.env.OUTBOX_POLL_INTERVAL_MS ?? "5000",
    10,
  ),
): () => void {
  if (intervalMs <= 0) {
    logger.info("Product outbox relay background sweeper is disabled");
    return () => {};
  }

  logger.info(
    `Starting product outbox relay background worker (interval: ${intervalMs}ms)`,
  );

  const sweep = async () => {
    if (isSweeping) return;
    isSweeping = true;
    try {
      await withClusterLock(
        redis.client,
        OUTBOX_CLUSTER_LEADER_KEY,
        OUTBOX_WORKER_ID,
        async () => {
          await processOutboxBatch();
        },
        { ttlMs: OUTBOX_LEADER_TTL_MS },
      );
    } catch (error) {
      logger.error("Error during product outbox relay sweep", error);
    } finally {
      isSweeping = false;
    }
  };

  const timer = setInterval(sweep, intervalMs);
  timer.unref();

  return () => {
    clearInterval(timer);
  };
}
