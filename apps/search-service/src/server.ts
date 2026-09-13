import Fastify from "fastify";
import { config } from "./config/config.js";
import { logger } from "./observability/metrics.js";
import { initTracing } from "./observability/tracing.js";
import { configureFastifyPlugins } from "./plugins/fastify.js";
import { searchRoutes } from "./routes/search.js";
import { suggestionRoutes } from "./routes/suggestions.js";
import { indexingRoutes } from "./routes/indexing.js";
import { healthRoutes } from "./routes/health.js";
import { ensureProductIndexExists } from "@repo/opensearch";
import { getOpenSearchClient, closeOpenSearchClient } from "./opensearch/client.js";
import { getRedisClient, closeRedisClient } from "./utils/redis.js";
import { consumer, producer } from "./utils/kafka.js";
import { registerProductEventSubscriptions } from "./consumers/product-events.consumer.js";

async function bootstrap() {
  const app = Fastify({
    logger: false, // We use custom @repo/monitoring logger
    disableRequestLogging: true,
  });

  // 1. Initialize Tracing
  initTracing();

  // 2. Plugins & Global Middlewares
  await configureFastifyPlugins(app);

  // 3. Register Routes
  // Health & Metrics (Root)
  await app.register(healthRoutes);

  // API v1 Routes
  await app.register(
    async (v1) => {
      await v1.register(searchRoutes);
      await v1.register(suggestionRoutes);
      await v1.register(indexingRoutes);
    },
    { prefix: "/api/v1" },
  );

  // 4. Connect Redis client
  getRedisClient();

  // 5. Ensure OpenSearch index & alias are created
  try {
    await ensureProductIndexExists(getOpenSearchClient(), config.opensearch.indexName, config.opensearch.aliasName, logger);
  } catch (error) {
    logger.warn("OpenSearch index check failed on startup (will retry on incoming events/queries)", {
      error,
    });
  }

  // 6. Connect Kafka & register event subscriptions
  try {
    await consumer.connect();
    logger.info(`Kafka consumer connected for group: ${config.kafka.groupId}`);
    await registerProductEventSubscriptions(consumer);
  } catch (error) {
    logger.warn("Kafka initialization deferred or failed", { error });
  }

  // 7. Start HTTP Server
  try {
    await app.listen({
      port: config.app.port,
      host: config.app.host,
    });
    logger.info(`Search service listening on http://${config.app.host}:${config.app.port}`);
  } catch (error) {
    logger.fatal("Failed to start search-service HTTP server", { error });
    process.exit(1);
  }

  // 8. Graceful Shutdown Handlers
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, initiating graceful shutdown...`);

    try {
      await app.close();
      logger.info("Fastify server closed");

      try {
        await consumer.disconnect();
        logger.info("Kafka consumer disconnected");
      } catch (error) {
        logger.error("Error disconnecting Kafka consumer", { error });
      }
      await closeRedisClient();
      await closeOpenSearchClient();

      logger.info("All search-service connections closed gracefully");
      process.exit(0);
    } catch (error) {
      logger.error("Error during graceful shutdown", { error });
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  logger.fatal("Uncaught error during search-service bootstrap", { err });
  process.exit(1);
});
