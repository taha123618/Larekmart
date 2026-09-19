import { Router, type Request, type Response } from "express";
import {
  createHealthRegistry,
  createMemoryCheck,
  createDbCheck,
} from "@repo/monitoring";
import { isCartDbConnected } from "@repo/cart-db";
import { metrics } from "../observability/metrics.js";
import { redis } from "../utils/redis.js";

const router: Router = Router();
export const health = createHealthRegistry("cart-service", "1.0.0");

health.register("memory", createMemoryCheck(512 * 1024 * 1024), {
  critical: false,
});

health.register(
  "mongodb",
  async () => {
    const started = Date.now();
    const connected = isCartDbConnected();
    return {
      status: connected ? "healthy" : "unhealthy",
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
      message: connected
        ? "MongoDB cart connection active"
        : "MongoDB cart connection down",
    };
  },
  { critical: true },
);

health.register(
  "redis",
  createDbCheck("Redis", async () => {
    if (!(await redis.ping())) {
      throw new Error("PING did not return PONG");
    }
  }),
  { critical: false },
);

router.get("/health", async (req: Request, res: Response) => {
  const report = await health.runChecks();
  const statusCode = report.status === "unhealthy" ? 503 : 200;
  res.status(statusCode).json(report);
});

router.get("/metrics", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4");
  res.send(metrics.toPrometheus());
});

export default router;
