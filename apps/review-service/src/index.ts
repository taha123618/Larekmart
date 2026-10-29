import { buildServer } from "./server.js";
import { env } from "./config/env.js";
import { initProducer } from "./publishers/review.publisher.js";
import { startKafkaConsumers } from "./consumers/index.js";
import { runMigrations } from "./db/migrate.js";
import { pool } from "./db/connection.js";
import { redis } from "./utils/redis.js";

async function main() {
  console.log("Starting Larekmart review-service...");

  // 1. Run migrations if explicitly requested (opt-in for development via AUTO_MIGRATE=true)
  if (process.env.AUTO_MIGRATE === "true") {
    try {
      await runMigrations();
    } catch (err) {
      console.warn(
        "[review-service] Database migration skipped or deferred:",
        err,
      );
    }
  }

  // 2. Initialize Kafka Producers & Consumers
  await initProducer();
  await startKafkaConsumers();

  // 3. Build & Start Fastify HTTP Server
  const app = await buildServer();

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
    console.log(
      `[review-service] Server listening on ${address} (port: ${env.PORT})`,
    );
  } catch (err) {
    console.error("[review-service] Fatal server error:", err);
    process.exit(1);
  }

  // 4. Graceful Shutdown
  const signals = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(
        `[review-service] Received ${signal}. Initiating graceful shutdown...`,
      );
      try {
        await app.close();
        await pool.end();
        await redis.close();
        console.log("[review-service] Graceful shutdown complete.");
        process.exit(0);
      } catch (err) {
        console.error("[review-service] Error during shutdown:", err);
        process.exit(1);
      }
    });
  }
}

main().catch((err) => {
  console.error("Unhandled review-service fatal error:", err);
  process.exit(1);
});
