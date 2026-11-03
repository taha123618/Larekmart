import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import { env } from "../config/env.js";

const { Pool } = pg;

export function normalizeDatabaseUrl(url?: string): string | undefined {
  if (!url) return undefined;
  let normalized = url;
  if (normalized.includes(":6432") && !normalized.includes("pgbouncer=true")) {
    const sep = normalized.includes("?") ? "&" : "?";
    normalized = `${normalized}${sep}pgbouncer=true`;
  }
  if (
    (normalized.includes(":6432") || normalized.includes("pgbouncer=true")) &&
    !normalized.includes("statement_cache_size=0")
  ) {
    const sep = normalized.includes("?") ? "&" : "?";
    normalized = `${normalized}${sep}statement_cache_size=0`;
  }
  return normalized;
}

const connectionString =
  normalizeDatabaseUrl(env.DATABASE_URL) ||
  "postgresql://postgres:admin123@localhost:5432/commission_db?sslmode=disable";

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

export async function checkDatabaseHealth(): Promise<{
  status: "up" | "down";
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return { status: "up", latencyMs: Date.now() - start };
    } finally {
      client.release();
    }
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
