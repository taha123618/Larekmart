import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { initProducer } from "./events/producers/wishlist.producer.js";
import { startKafkaConsumers } from "./events/consumers/index.js";
import { runMigrations } from "./db/migrate.js";
import { pool } from "./db/connection.js";
import { redis } from "./utils/redis.js";
import { logger } from "./observability/metrics.js";

export { buildApp };

export async function startServer() {
  logger.info("Starting Larekmart wishlist-service...");

  // 1. Run migrations if DB is accessible
  try {
    await runMigrations();
  } catch (err) {
    logger.warn("Database migration skipped or deferred:", { err });
  }

  // 2. Initialize Kafka Producers & Consumers
  await initProducer();
  await startKafkaConsumers();

  // 3. Build & Start Fastify App
  const app = await buildApp();

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
    logger.info(
      `[wishlist-service] Server listening on ${address} (port: ${env.PORT})`,
    );
  } catch (err) {
    logger.error("[wishlist-service] Fatal server error:", { err });
    process.exit(1);
  }

  // 4. Graceful Shutdown
  const signals = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(
        `[wishlist-service] Received ${signal}. Initiating graceful shutdown...`,
      );
      try {
        await app.close();
        await pool.end();
        await redis.close();
        logger.info("[wishlist-service] Graceful shutdown complete.");
        process.exit(0);
      } catch (err) {
        logger.error("[wishlist-service] Error during shutdown:", { err });
        process.exit(1);
      }
    });
  }

  return app;
}
