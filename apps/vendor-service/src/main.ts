import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger } from "@nestjs/common";
import type { FastifyInstance } from "fastify";
import { GATEWAY_HEADERS } from "@repo/types";
import { prisma } from "@repo/vendor-db";
import { AppModule } from "./app.module.js";
import { env } from "./config/env.js";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Stamps successful mutations with the PostgreSQL WAL high-water mark so the
 * API Gateway can cache a per-session LSN for Read-Your-Writes replica lag
 * detection downstream. WAL is monotonic, so the position read here (after the
 * handler committed) always covers the mutation that was executed.
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
  const logger = new Logger("VendorServiceBootstrap");
  const adapter = new FastifyAdapter();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );

  const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());

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
      "x-user-id",
      "x-user-role",
      "x-user-email",
      "x-internal-secret",
    ],
    credentials: true,
  });

  // Register the WAL LSN emission hook on the underlying Fastify instance
  // before routes boot (Fastify rejects hooks added after ready()).
  registerWalLsnEmission(
    app.getHttpAdapter().getInstance() as unknown as FastifyInstance,
  );

  app.enableShutdownHooks();

  await app.listen(env.PORT, env.HOST);
  logger.log(`vendor-service listening on http://${env.HOST}:${env.PORT}`);
}

bootstrap().catch((err) => {
  console.error("Fatal error during vendor-service bootstrap:", err);
  process.exit(1);
});
