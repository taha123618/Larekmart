import { env } from "./config/env.js";
import { logger } from "./observability/metrics.js";
import { buildServer } from "./server.js";
import { redis } from "./utils/redis.js";
import { consumer, producer } from "./utils/kafka.js";
import { disconnectPrisma } from "@repo/catalog-db";
import { startKafkaConsumers } from "./consumers/index.js";

async function main() {
  logger.info("Starting catalog-service...", {
    port: env.PORT,
    host: env.HOST,
    env: env.NODE_ENV,
  });

  const app = await buildServer();

  // 1. Connect Kafka consumers
  await startKafkaConsumers();

  // 2. Start HTTP server
  try {
    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
    logger.info(`Catalog service listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    logger.fatal("Failed to bind catalog-service port", { error: String(err) });
    process.exit(1);
  }

  // 3. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down catalog-service gracefully...`);
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

      await redis.close();
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
  logger.fatal("Fatal error bootstrapping catalog-service", { error: String(err) });
  process.exit(1);
});
