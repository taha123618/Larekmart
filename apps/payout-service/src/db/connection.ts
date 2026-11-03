import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { env } from "../config/env.js";
import * as schema from "./schema.js";

function normalizePgUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.searchParams.has("statement_cache_size")) {
      parsed.searchParams.set("statement_cache_size", "0");
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export const pool = new Pool({
  connectionString: normalizePgUrl(env.DATABASE_URL),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

export async function checkDbHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}
