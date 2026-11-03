import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger } from "@nestjs/common";
import type { FastifyInstance } from "fastify";
import { resolveCorsOrigins } from "@repo/types";
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

  // 1. Strict CORS origin allowlist
  const allowedOrigins = resolveCorsOrigins(
    process.env.CORS_ORIGIN || "http://localhost:3002,http://localhost:3003",
  );

  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        env.NODE_ENV !== "production"
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"), false);
      }
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "x-user-id",
      "x-user-role",
      "x-seller-id",
      "x-internal-secret",
    ],
    credentials: true,
  });

  // 2. Defensive HTTP Security Headers
  const fastifyInstance = app
    .getHttpAdapter()
    .getInstance() as unknown as FastifyInstance;
  fastifyInstance.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("X-XSS-Protection", "1; mode=block");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
    return payload;
  });

  app.enableShutdownHooks();

  await app.listen(env.PORT, env.HOST);
  logger.log(
    `Payout Service running on port ${env.PORT} in ${env.NODE_ENV} mode`,
  );
}

bootstrap().catch((err) => {
  console.error("Fatal startup error in payout-service:", err);
  process.exit(1);
});
