import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger } from "@nestjs/common";
import type { FastifyInstance } from "fastify";
import { GATEWAY_HEADERS, resolveCorsOrigins } from "@repo/types";
import { prisma } from "@repo/support-db";
import { AppModule } from "./app.module.js";
import { env } from "./config/env.js";
import { RealtimeService } from "./realtime/realtime.service.js";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Stamps successful mutations with the PostgreSQL WAL high-water mark so the
 * API Gateway can cache a per-session LSN for Read-Your-Writes replica lag
 * detection downstream.
 */
function registerWalLsnEmission(instance: FastifyInstance): void {
  instance.addHook("onSend", async (request, reply, payload) => {
    if (
      MUTATION_METHODS.has(request.method) &&
      reply.statusCode >= 200 &&
      reply.statusCode < 300
    ) {
      try {
        const rows = await prisma.$queryRaw<
          Array<{ lsn: string | null }>
        >`SELECT pg_current_wal_lsn()::text AS lsn`;
        const lsn = rows[0]?.lsn;
        if (lsn) reply.header(GATEWAY_HEADERS.DB_LSN, lsn);
      } catch {
        // Graceful degradation: the 500ms time-based RYW lease still applies
      }
    }
    return payload;
  });
}

async function bootstrap() {
  const logger = new Logger("SupportServiceBootstrap");
  const adapter = new FastifyAdapter();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );

  // 1. Strict CORS origin allowlist
  const allowedOrigins = resolveCorsOrigins(
    process.env.CORS_ORIGIN || env.ALLOWED_ORIGINS,
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
      "x-user-email",
      "x-user-is-seller",
      "x-user-is-super-admin",
      "x-internal-secret",
    ],
    credentials: true,
  });

  const fastifyInstance = app
    .getHttpAdapter()
    .getInstance() as unknown as FastifyInstance;

  // 2. Defensive HTTP Security Headers
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

  // 3. Register WAL LSN emission hook for RYW consistency
  registerWalLsnEmission(fastifyInstance);

  // Initialize Socket.IO with underlying HTTP server
  const realtimeService = app.get(RealtimeService);
  realtimeService.initialize(fastifyInstance.server);

  app.enableShutdownHooks();

  await app.listen(env.PORT, env.HOST);
  logger.log(`support-service listening on http://${env.HOST}:${env.PORT}`);
}

bootstrap().catch((err) => {
  console.error("Fatal error during support-service bootstrap:", err);
  process.exit(1);
});
