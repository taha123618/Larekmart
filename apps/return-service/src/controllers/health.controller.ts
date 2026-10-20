import type { Context } from "koa";
import { getDb } from "../db/connection.js";
import { sql } from "drizzle-orm";
import { createMetricsRegistry } from "@repo/monitoring";

export const metricsRegistry = createMetricsRegistry("return-service");

export class HealthController {
  async health(ctx: Context): Promise<void> {
    try {
      await getDb().execute(sql`SELECT 1`);
      ctx.body = {
        status: "ok",
        service: "return-service",
        timestamp: new Date().toISOString(),
        db: "connected",
      };
    } catch {
      ctx.status = 503;
      ctx.body = {
        status: "degraded",
        service: "return-service",
        timestamp: new Date().toISOString(),
        db: "unavailable",
      };
    }
  }

  ready(ctx: Context): void {
    ctx.body = { status: "ready", service: "return-service" };
  }

  metrics(ctx: Context): void {
    ctx.type = "text/plain; version=0.0.4";
    ctx.body = metricsRegistry.toPrometheus();
  }
}

export const healthController = new HealthController();
