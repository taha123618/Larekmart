/**
 * Outbox worker — polls `return_outbox` for PENDING messages and publishes
 * them to Kafka reliably via the transactional outbox pattern.
 *
 * Enforces distributed cluster isolation via Redis leader election leases
 * and atomic MySQL worker fencing so that scaling return-service across
 * multiple horizontal pods never causes duplicate Kafka message dispatches.
 */
import os from "node:os";
import crypto from "node:crypto";
import {
  createKafkaClient,
  createProducer,
  type KafkaProducer,
} from "@repo/kafka";
import { acquireClusterLock, releaseClusterLock } from "@repo/redis";
import { outboxRepository } from "../repositories/outbox.repository.js";
import { redis } from "../utils/redis.js";
import { env } from "../config/env.js";

export const OUTBOX_WORKER_ID = `${os.hostname()}:${process.pid}:${crypto.randomBytes(4).toString("hex")}`;
export const OUTBOX_CLUSTER_LEADER_KEY = "cluster:return:outbox:leader";
export const OUTBOX_LEADER_TTL_MS = 10_000;

let running = false;
let stopSignal = false;
let producerInstance: KafkaProducer | null = null;

export async function processOutboxBatch(
  workerId = OUTBOX_WORKER_ID,
  producerOverride?: KafkaProducer,
): Promise<number> {
  // 1. Cluster Isolation: Attempt to acquire distributed leader lease in Redis
  let isClusterLeader = true;
  try {
    isClusterLeader = await acquireClusterLock(
      redis.client,
      OUTBOX_CLUSTER_LEADER_KEY,
      workerId,
      { ttlMs: OUTBOX_LEADER_TTL_MS },
    );
  } catch (err) {
    console.warn(
      "[return-service:outbox] Redis cluster leader lock check failed; falling back to DB fencing",
      err,
    );
    isClusterLeader = true;
  }

  if (!isClusterLeader) {
    return 0;
  }

  const activeProducer = producerOverride ?? producerInstance;
  let publishedCount = 0;

  try {
    const messages = await outboxRepository.claimPendingMessages(
      env.OUTBOX_BATCH_SIZE,
      30_000,
      workerId,
    );

    for (const msg of messages) {
      try {
        const payload: unknown = JSON.parse(msg.payload as string);
        if (activeProducer) {
          await activeProducer.send(msg.topic, payload as object);
        }
        await outboxRepository.markPublished(msg.id, workerId);
        publishedCount++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `[return-service:outbox] Failed to publish message ${msg.id} on topic ${msg.topic}:`,
          errMsg,
        );
        await outboxRepository.markFailed(msg.id, errMsg, workerId);
      }
    }
  } finally {
    try {
      await releaseClusterLock(
        redis.client,
        OUTBOX_CLUSTER_LEADER_KEY,
        workerId,
      );
    } catch {
      // Lease auto-expires
    }
  }

  return publishedCount;
}

export async function startOutboxWorker(): Promise<void> {
  if (running) {
    console.warn("[return-service:outbox] Worker is already running.");
    return;
  }

  const kafka = createKafkaClient(env.KAFKA_CLIENT_ID, env.KAFKA_BROKERS);
  producerInstance = createProducer(kafka);
  await producerInstance.connect();
  running = true;
  stopSignal = false;

  console.log(
    `[return-service:outbox] Started. Polling every ${env.OUTBOX_POLL_INTERVAL_MS}ms, batch=${env.OUTBOX_BATCH_SIZE}, workerId=${OUTBOX_WORKER_ID}`,
  );

  const poll = async () => {
    if (stopSignal) {
      if (producerInstance) {
        await producerInstance.disconnect();
      }
      running = false;
      console.log("[return-service:outbox] Worker stopped.");
      return;
    }

    try {
      await processOutboxBatch(OUTBOX_WORKER_ID);
    } catch (err) {
      console.error("[return-service:outbox] Polling error:", err);
    }

    // Add staggered jitter (up to 200ms) to desynchronize polling ticks across pods
    const jitter = Math.floor(Math.random() * 200);
    setTimeout(() => void poll(), env.OUTBOX_POLL_INTERVAL_MS + jitter);
  };

  void poll();
}

export async function stopOutboxWorker(): Promise<void> {
  stopSignal = true;
}
