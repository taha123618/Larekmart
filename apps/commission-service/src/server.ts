import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { runMigrations } from "./db/migrate.js";
import { commissionEventProducer } from "./kafka/producer.js";
import { commissionEventConsumer } from "./kafka/consumer.js";

export async function startServer() {
  const app = buildApp();

  try {
    // 1. Run DB migrations
    await runMigrations();

    // 2. Connect Kafka producer & consumer
    await commissionEventProducer.connect();
    await commissionEventConsumer.start();

    // 3. Listen on configured port
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(
      `[CommissionService] Running in ${env.NODE_ENV} mode on port ${env.PORT}`,
    );

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`[CommissionService] Received ${signal}, closing server...`);
      await commissionEventConsumer.stop();
      await app.close();
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("[CommissionService] Failed to start:", err);
    process.exit(1);
  }
}
