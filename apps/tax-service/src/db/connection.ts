import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

let pool: mysql.Pool | null = null;
let dbInstance: MySql2Database<typeof schema> | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    if (env.MYSQL_URL) {
      pool = mysql.createPool(env.MYSQL_URL);
    } else {
      pool = mysql.createPool({
        host: env.MYSQL_HOST,
        port: env.MYSQL_PORT,
        user: env.MYSQL_USER,
        password: env.MYSQL_PASSWORD,
        database: env.MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
    }
  }
  return pool;
}

export function getDb(): MySql2Database<typeof schema> {
  if (!dbInstance) {
    const p = getPool();
    dbInstance = drizzle(p, { schema, mode: "default" });
  }
  return dbInstance;
}

export async function checkDatabaseConnection(): Promise<{
  healthy: boolean;
  error?: string;
}> {
  try {
    const p = getPool();
    const conn = await p.getConnection();
    await conn.ping();
    conn.release();
    return { healthy: true };
  } catch (err) {
    return {
      healthy: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
  }
}
