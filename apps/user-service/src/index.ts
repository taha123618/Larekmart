import { env } from "./config/env.js";
import { logger } from "./observability/metrics.js";
import { buildServer } from "./server.js";
import { redis } from "./utils/redis.js";
import { producer, consumer } from "./utils/kafka.js";
import { initProducer } from "./publishers/user.publisher.js";
import { startKafkaConsumers } from "./consumers/index.js";
import { disconnectPrisma } from "@repo/user-db";

async function main() {
  logger.info("Starting user-service...", {
    port: env.PORT,
    host: env.HOST,
    env: env.NODE_ENV,
  });

  const app = await buildServer();

  // 1. Initialize Kafka Producer & Consumers
  try {
    await initProducer();
  } catch (err) {
    logger.warn("Kafka producer initialization deferred / offline", {
      error: String(err),
    });
  }

  await startKafkaConsumers();

  // 2. Start HTTP server
  try {
    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
    logger.info(`User service listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    logger.fatal("Failed to bind user-service port", { error: String(err) });
    process.exit(1);
  }

  // 3. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down user-service gracefully...`);
    try {
      await app.close();
      logger.info("Fastify server closed");

      try {
        await consumer.disconnect();
        await producer.disconnect();
        logger.info("Kafka consumer and producer disconnected");
      } catch (err) {
        logger.warn("Error disconnecting Kafka", { error: String(err) });
      }

      await redis.client.quit();
      logger.info("Redis connection closed");

      await disconnectPrisma();
      logger.info("Prisma database connection closed");

      process.exit(0);
    } catch (error) {
      logger.error("Error during graceful shutdown", { error: String(error) });
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal("Fatal error bootstrapping user-service", {
    error: String(err),
  });
  process.exit(1);
});
