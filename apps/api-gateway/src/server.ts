import { env } from "./config/env.js";
import { logger } from "./observability/logger.js";
import { buildApp } from "./app.js";
import { redis } from "./utils/redis.js";

export { buildApp, buildGatewayServer } from "./app.js";

export async function startServer() {
  logger.info("Initializing Larekmart API Gateway...", {
    port: env.PORT,
    host: env.HOST,
    env: env.NODE_ENV,
  });

  const app = await buildApp();

  try {
    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
    logger.info(`Larekmart API Gateway listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    logger.fatal("Failed to bind API Gateway port", { error: String(err) });
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down API Gateway gracefully...`);
    try {
      await app.close();
      await redis.close();
      logger.info("API Gateway server closed successfully");
      process.exit(0);
    } catch (error) {
      logger.error("Error during API Gateway shutdown", { error: String(error) });
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  return app;
}
