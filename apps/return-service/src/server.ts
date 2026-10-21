import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { getDb } from "./db/connection.js";
import { sql } from "drizzle-orm";
import { startOutboxWorker } from "./workers/outbox.worker.js";
import { startConsumers } from "./workers/consumers.js";

export async function startServer(): Promise<void> {
  // Verify DB connectivity before accepting traffic
  await getDb().execute(sql`SELECT 1`);
  console.log("[return-service] Database connection verified.");

  // Start background workers
  await startConsumers();
  await startOutboxWorker();

  const app = createApp();

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(env.PORT, env.HOST, () => {
      console.log(
        `[return-service] Listening on http://${env.HOST}:${env.PORT}`,
      );
      resolve();
    });
    server.on("error", reject);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(
        `[return-service] Received ${signal}. Shutting down gracefully…`,
      );
      server.close(() => {
        console.log("[return-service] HTTP server closed.");
        process.exit(0);
      });
      // Give existing requests up to 10 s to complete
      setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
  });
}
