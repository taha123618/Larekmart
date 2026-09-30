import { Hono } from "hono";
import { createHealthRegistry, createMemoryCheck } from "@repo/monitoring";
import { getServiceContainer } from "../container.js";
import { logger, metrics } from "../observability/metrics.js";
import { redis } from "../utils/redis.js";

const healthRoute = new Hono();
const health = createHealthRegistry("media-service", "1.0.0");

health.register("memory", createMemoryCheck(512 * 1024 * 1024), {
  critical: false,
});

async function dbProbe(): Promise<boolean> {
  try {
    const { sql } = await import("drizzle-orm");
    const { db } = await import("../db/client.js");
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    logger.warn(`PostgreSQL readiness probe failed: ${String(error)}`);
    return false;
  }
}

// Full health report
healthRoute.get("/", async (c) => {
  const report = await health.runChecks();
  return c.json(report, report.status === "unhealthy" ? 503 : 200);
});

// Liveness: process alive, no external dependencies
healthRoute.get("/live", (c) => c.json({ status: "alive" }));

// Readiness: PostgreSQL + Redis + storage connectivity
healthRoute.get("/ready", async (c) => {
  const { storage } = getServiceContainer();
  const checks: Record<string, boolean> = {};

  checks.postgres = await dbProbe();
  checks.redis = await redis.ping().catch(() => false);
  checks.storage = await storage.checkConnectivity();

  const ready = Object.values(checks).every(Boolean);
  return c.json(
    { status: ready ? "ready" : "not_ready", checks },
    ready ? 200 : 503,
  );
});

export { healthRoute, dbProbe };
export default healthRoute;
