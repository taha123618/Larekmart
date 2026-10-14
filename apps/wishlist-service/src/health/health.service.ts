import { pool } from "../db/connection.js";
import { redis } from "../utils/redis.js";

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  service: string;
  checks: {
    database: string;
    redis: string;
  };
}

export async function checkWishlistHealth(): Promise<HealthCheckResult> {
  let dbStatus = "healthy";
  let redisStatus = "healthy";

  try {
    await pool.query("SELECT 1");
  } catch {
    dbStatus = "unhealthy";
  }

  try {
    const pong = await redis.client.ping();
    if (pong !== "PONG") redisStatus = "unhealthy";
  } catch {
    redisStatus = "unhealthy";
  }

  const isHealthy = dbStatus === "healthy";
  return {
    status: isHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    service: "wishlist-service",
    checks: {
      database: dbStatus,
      redis: redisStatus,
    },
  };
}
