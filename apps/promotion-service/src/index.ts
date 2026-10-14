import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./observability/metrics.js";
import { pool } from "./db/connection.js";
import { redis } from "./utils/redis.js";
import { producer, consumer } from "./utils/kafka.js";
import { initProducer } from "./events/producers/promotion.producer.js";
import { startKafkaConsumers } from "./events/consumers/index.js";
import { startReservationExpiryWorker } from "./workers/reservation-expiry.worker.js";

let stopExpiryWorker: (() => void) | null = null;

async function start(): Promise<void> {
  try {
    // 1. Initialize Kafka
    await initProducer();
    await startKafkaConsumers();

    // 2. Start background workers
    stopExpiryWorker = startReservationExpiryWorker(60000);

    // 3. Start HTTP server
    serve({ fetch: app.fetch, port: env.PORT }, () => {
      logger.info(`Promotion service is running on port ${env.PORT}`);
    });
  } catch (error) {
    logger.fatal("Failed to initialize promotion-service", error);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  if (stopExpiryWorker) {
    stopExpiryWorker();
  }
  try {
    await consumer.disconnect();
  } catch (err) {
    logger.error("Error disconnecting Kafka consumer", err);
  }
  try {
    await producer.disconnect();
  } catch (err) {
    logger.error("Error disconnecting Kafka producer", err);
  }
  try {
    await redis.close();
  } catch (err) {
    logger.error("Error closing Redis connection", err);
  }
  try {
    await pool.end();
  } catch (err) {
    logger.error("Error disconnecting Postgres pool", err);
  }
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

void start();
