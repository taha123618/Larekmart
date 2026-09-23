import type { Context } from "koa";
import { prisma } from "@repo/shipping-db";
import { redis } from "../utils/redis.js";

export class HealthController {
  static async getHealth(ctx: Context): Promise<void> {
    let pgOk = false;
    let redisOk = false;

    try {
      await prisma.$queryRaw`SELECT 1`;
      pgOk = true;
    } catch {
      pgOk = false;
    }

    try {
      const pingRes = await redis.ping();
      redisOk = pingRes;
    } catch {
      redisOk = false;
    }

    const isHealthy = pgOk && redisOk;
    ctx.status = isHealthy ? 200 : 503;
    ctx.body = {
      status: isHealthy ? "ok" : "degraded",
      service: "shipping-service",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dependencies: {
        postgres: pgOk ? "connected" : "disconnected",
        redis: redisOk ? "connected" : "disconnected",
      },
    };
  }

  static getLive(ctx: Context): void {
    ctx.status = 200;
    ctx.body = { status: "live", service: "shipping-service" };
  }

  static async getReady(ctx: Context): Promise<void> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      ctx.status = 200;
      ctx.body = { status: "ready", service: "shipping-service" };
    } catch {
      ctx.status = 503;
      ctx.body = { status: "not_ready", error: "Database unavailable" };
    }
  }
}
