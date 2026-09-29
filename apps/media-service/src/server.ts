import { serve } from "@hono/node-server";
import { createApp, shutdown } from "./app.js";
import { logger } from "./observability/metrics.js";
import { consumer, producer } from "./utils/kafka.js";
import { startDomainDeletionConsumer } from "./messaging/consumers/domain-deletion.consumer.js";
import { handleProductMediaClaim } from "./messaging/consumers/product-claim.consumer.js";
import { handleUserAvatarClaim } from "./messaging/consumers/user-claim.consumer.js";
import { db } from "./db/client.js";

/**
 * media-service API entrypoint. Owns HTTP routing + upload lifecycle;
 * image processing runs in media-worker (independently scalable).
 */
const port = Number.parseInt(process.env.PORT ?? "8013", 10);

async function start(): Promise<void> {
  const app = createApp();

  try {
    await producer.connect();
    await consumer.connect();
    await startDomainDeletionConsumer(consumer, db);
    // Claim media referenced by products so ownership tracks the catalog
    // (draft uploads made by admin before the product row exists).
    await consumer.subscribe([
      {
        topicName: "product.created",
        topicHandler: async (message) => {
          try {
            await handleProductMediaClaim("product.created", message, db);
          } catch (error) {
            logger.error("Failed handling product.created media claim", error);
          }
        },
      },
      {
        topicName: "product.updated",
        topicHandler: async (message) => {
          try {
            await handleProductMediaClaim("product.updated", message, db);
          } catch (error) {
            logger.error("Failed handling product.updated media claim", error);
          }
        },
      },
      {
        topicName: "user.avatar_uploaded",
        topicHandler: async (message) => {
          try {
            await handleUserAvatarClaim(message, db);
          } catch (error) {
            logger.error("Failed handling user.avatar_uploaded media claim", error);
          }
        },
      },
    ]);
  } catch (error) {
    // Kafka is propagation, not correctness: start degraded rather than die.
    logger.error(
      "Kafka unavailable; media-service starting in degraded mode",
      error,
    );
  }

  serve({ fetch: app.fetch, port }, () => {
    logger.info(`media-service listening on port ${port}`);
  });
}

async function stop(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down media-service...`);
  try {
    await consumer.disconnect();
  } catch (error) {
    logger.error("Error disconnecting Kafka consumer", error);
  }
  try {
    await producer.disconnect();
  } catch (error) {
    logger.error("Error disconnecting Kafka producer", error);
  }
  await shutdown();
  process.exit(0);
}

process.on("SIGTERM", () => void stop("SIGTERM"));
process.on("SIGINT", () => void stop("SIGINT"));

start().catch((error) => {
  logger.fatal("Failed to start media-service", error);
  process.exit(1);
});
