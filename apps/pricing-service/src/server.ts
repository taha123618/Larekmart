import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { runMigrations } from "./db/migrate.js";
import { closeDatabase } from "./db/connection.js";
import { startKafkaConsumers } from "./kafka/consumer.js";
import { pricingEventProducer } from "./kafka/producer.js";

export { buildApp };

export async function startServer() {
  console.log("[PricingService] Starting Larekmart pricing-service...");

  // 1. Run migrations if explicitly requested (opt-in for development via AUTO_MIGRATE=true)
  if (process.env.AUTO_MIGRATE === "true") {
    try {
      await runMigrations();
    } catch (err) {
      console.warn(
        "[PricingService] Database migration skipped or deferred:",
        err,
      );
    }
  }

  // 2. Initialize Kafka Producers & Consumers
  await pricingEventProducer.connect();
  await startKafkaConsumers();

  // 3. Build & Start Fastify App
  const app = await buildApp();

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
    console.log(
      `[pricing-service] Server listening on ${address} (port: ${env.PORT})`,
    );
  } catch (err) {
    console.error("[pricing-service] Fatal server error:", err);
    process.exit(1);
  }

  // 4. Graceful Shutdown
  const signals = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(
        `[pricing-service] Received ${signal}. Initiating graceful shutdown...`,
      );
      try {
        await app.close();
        await closeDatabase();
        console.log("[pricing-service] Graceful shutdown complete.");
        process.exit(0);
      } catch (err) {
        console.error("[pricing-service] Error during shutdown:", err);
        process.exit(1);
      }
    });
  }

  return app;
}
