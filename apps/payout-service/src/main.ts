import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module.js";
import { env } from "./config/env.js";
import { runMigrations } from "./db/migrate.js";

async function bootstrap() {
  const logger = new Logger("PayoutService");

  // Attempt migrations if DB is accessible
  try {
    await runMigrations();
  } catch (err) {
    logger.warn(`Could not run migrations during startup: ${err}`);
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  await app.listen(env.PORT, "0.0.0.0");
  logger.log(`Payout Service running on port ${env.PORT} in ${env.NODE_ENV} mode`);
}

bootstrap().catch((err) => {
  console.error("Fatal startup error in payout-service:", err);
  process.exit(1);
});
