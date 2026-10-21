import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { runMigrations } from "./db/migrate.js";
import { closeDatabase } from "./db/connection.js";
import { sellerEventProducer } from "./kafka/producer.js";
import { cacheService } from "./services/cache.service.js";

export { buildApp };

export async function startServer() {
  console.log("[SellerService] Starting Larekmart seller-service...");

  // 1. Run migrations if DB is accessible
  try {
    await runMigrations();
  } catch (err) {
    console.warn("[SellerService] Database migration skipped or deferred:", err);
  }

  // 2. Initialize Kafka Producer
  await sellerEventProducer.connect();

  // 3. Build & Start Fastify App
  const app = await buildApp();

  try {
    const address = await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });
    console.log(`[SellerService] Server listening on ${address} (port: ${env.PORT})`);
  } catch (err) {
    console.error("[SellerService] Fatal server error:", err);
    process.exit(1);
  }

  // 4. Graceful Shutdown
  const signals = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`[SellerService] Received ${signal}. Initiating graceful shutdown...`);
      try {
        await app.close();
        await closeDatabase();
        await cacheService.close();
        console.log("[SellerService] Graceful shutdown complete.");
        process.exit(0);
      } catch (err) {
        console.error("[SellerService] Error during shutdown:", err);
        process.exit(1);
      }
    });
  }

  return app;
}
