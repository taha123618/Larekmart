/**
 * Outbox worker — polls `return_outbox` for PENDING messages and publishes
 * them to Kafka exactly-once via the transactional outbox pattern.
 *
 * Design decisions:
 * - Runs as an independent polling loop, not coupled to HTTP request lifecycle.
 * - Marks messages PUBLISHED (success) or FAILED (error) atomically.
 * - A bad message never crashes the loop — it is marked FAILED and skipped.
 */
import { createKafkaClient } from "@repo/kafka";
import { createProducer } from "@repo/kafka";
import { outboxRepository } from "../repositories/outbox.repository.js";
import { env } from "../config/env.js";

let running = false;
let stopSignal = false;

export async function startOutboxWorker(): Promise<void> {
  if (running) {
    console.warn("[return-service:outbox] Worker is already running.");
    return;
  }

  const kafka = createKafkaClient(env.KAFKA_CLIENT_ID, env.KAFKA_BROKERS);
  const producer = createProducer(kafka);
  await producer.connect();
  running = true;
  stopSignal = false;

  console.log(
    `[return-service:outbox] Started. Polling every ${env.OUTBOX_POLL_INTERVAL_MS}ms, batch=${env.OUTBOX_BATCH_SIZE}`,
  );

  const poll = async () => {
    if (stopSignal) {
      await producer.disconnect();
      running = false;
      console.log("[return-service:outbox] Worker stopped.");
      return;
    }

    try {
      const messages = await outboxRepository.getPendingMessages(env.OUTBOX_BATCH_SIZE);

      for (const msg of messages) {
        try {
          const payload: unknown = JSON.parse(msg.payload as string);
          await producer.send(msg.topic, payload as object);
          await outboxRepository.markPublished(msg.id);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(
            `[return-service:outbox] Failed to publish message ${msg.id} on topic ${msg.topic}:`,
            errMsg,
          );
          await outboxRepository.markFailed(msg.id, errMsg);
        }
      }
    } catch (err) {
      // DB connectivity error — log and continue polling
      console.error("[return-service:outbox] Polling error:", err);
    }

    setTimeout(() => void poll(), env.OUTBOX_POLL_INTERVAL_MS);
  };

  void poll();
}

export async function stopOutboxWorker(): Promise<void> {
  stopSignal = true;
}
