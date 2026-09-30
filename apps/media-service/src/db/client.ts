import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema/index.js";

export type MediaDb = NodePgDatabase<typeof schema>;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db: MediaDb = drizzle(pool, { schema });
export { schema };

/** Closes the connection pool on shutdown. */
export async function closeDb(): Promise<void> {
  await pool.end();
}
