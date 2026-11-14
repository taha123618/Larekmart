import os from "node:os";
import { randomUUID } from "node:crypto";
import { eq, asc, lt } from "drizzle-orm";
import { withClusterLock } from "@repo/redis";
import { db } from "../db/connection.js";
import { pricingOutbox, type PricingOutboxEvent } from "../db/schema.js";
import { producer } from "../utils/kafka.js";
import { redis } from "../utils/redis.js";

export const PRICING_OUTBOX_WORKER_ID = `${process.env.HOSTNAME || os.hostname() || "pricing-worker"}:${process.pid}:${randomUUID().slice(0, 8)}`;
export const PRICING_OUTBOX_CLUSTER_LEADER_KEY = "pricing:outbox:sweeper:leader";
export const PRICING_OUTBOX_LEADER_TTL_MS = 10_000;
export const PRICING_OUTBOX_MAX_RETRIES = 5;

let isSweeping = false;
let lastRetentionPurge = 0;
const RETENTION_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RETENTION_DAYS = 7;

/**
 * Claims and processes a batch of PENDING outbox events with idempotency and retry handling.
 *
 * @param batchSize - Maximum number of pending records to fetch per sweep
 * @returns Number of successfully published events
 */
export async function processPricingOutboxBatch(batchSize = 50): Promise<number> {
  const events = await db
    .select()
    .from(pricingOutbox)
    .where(eq(pricingOutbox.status, "PENDING"))
    .orderBy(asc(pricingOutbox.createdAt))
    .limit(batchSize);

  if (!events || events.length === 0) {
    return 0;
  }

  let publishedCount = 0;

  for (const event of events) {
    try {
      const payload = event.payload as Record<string, unknown>;
      const partitionKey =
        payload?.quoteId ||
        payload?.productId ||
        payload?.id ||
        event.id;

      await producer.send(
        event.topic,
        { value: event.payload },
        partitionKey ? { key: String(partitionKey) } : undefined,
      );

      await db
        .update(pricingOutbox)
        .set({
          status: "PUBLISHED",
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(pricingOutbox.id, event.id));

      publishedCount++;
    } catch (err) {
      const nextRetry = event.retryCount + 1;
      const errorMessage = err instanceof Error ? err.message : String(err);

      console.warn("[PricingOutbox] Failed to publish event to Kafka:", {
        eventId: event.id,
        topic: event.topic,
        retryCount: nextRetry,
        error: errorMessage,
      });

      await db
        .update(pricingOutbox)
        .set({
          retryCount: nextRetry,
          status: nextRetry >= PRICING_OUTBOX_MAX_RETRIES ? "FAILED" : "PENDING",
          lastError: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(pricingOutbox.id, event.id));
    }
  }

  // Periodic sliding retention purge: delete PUBLISHED records older than 7 days
  const now = Date.now();
  if (now - lastRetentionPurge > RETENTION_PURGE_INTERVAL_MS) {
    lastRetentionPurge = now;
    try {
      const retentionThreshold = new Date(
        now - RETENTION_DAYS * 24 * 60 * 60 * 1000,
      );
      await db
        .delete(pricingOutbox)
        .where(
          eq(pricingOutbox.status, "PUBLISHED") &&
            lt(pricingOutbox.publishedAt, retentionThreshold),
        );
    } catch (purgeErr) {
      console.warn("[PricingOutbox] Failed to purge aged outbox events:", purgeErr);
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
export function startPricingOutboxRelay(
  intervalMs = Number.parseInt(
    process.env.PRICING_OUTBOX_POLL_INTERVAL_MS ?? "5000",
    10,
  ),
): () => void {
  if (intervalMs <= 0) {
    console.log("[PricingOutbox] Background outbox relay sweeper is disabled");
    return () => {};
  }

  console.log(
    `[PricingOutbox] Starting pricing outbox relay worker (interval: ${intervalMs}ms)`,
  );

  const sweep = async () => {
    if (isSweeping) return;
    isSweeping = true;
    try {
      await withClusterLock(
        redis.client,
        PRICING_OUTBOX_CLUSTER_LEADER_KEY,
        PRICING_OUTBOX_WORKER_ID,
        async () => {
          await processPricingOutboxBatch();
        },
        { ttlMs: PRICING_OUTBOX_LEADER_TTL_MS },
      );
    } catch (error) {
      console.error("[PricingOutbox] Error during outbox relay sweep:", error);
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
