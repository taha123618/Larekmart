import { buildServer } from "./server.js";
import { env } from "./config/env.js";
import { startKafka } from "./events/index.js";
import { closeDatabase } from "./db/connection.js";
import { redis } from "./utils/redis.js";

async function main() {
  console.log("Starting Larekmart tax-service...");

  // 1. Initialize Kafka Producers & Consumers in background
  startKafka().catch((err) => {
    console.warn("[tax-service] Kafka initialization warning:", err);
  });

  // 2. Build & Start Fastify HTTP Server
  const app = await buildServer();

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
    console.log(
      `[tax-service] Server listening on ${address} (port: ${env.PORT})`,
    );
  } catch (err) {
    console.error("[tax-service] Fatal server error:", err);
    process.exit(1);
  }

  // 3. Graceful Shutdown
  const signals = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(
        `[tax-service] Received ${signal}. Initiating graceful shutdown...`,
      );
      try {
        await app.close();
        await closeDatabase();
        await redis.close();
        console.log("[tax-service] Graceful shutdown complete.");
        process.exit(0);
      } catch (err) {
        console.error("[tax-service] Error during shutdown:", err);
        process.exit(1);
      }
    });
  }
}

main().catch((err) => {
  console.error("Unhandled tax-service fatal error:", err);
  process.exit(1);
});
