import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, db } from "./client.js";

/**
 * Applies pending Drizzle migrations. Runs via `pnpm --filter media-service
 * db:migrate` and from the Docker container entrypoint before start.
 */
async function main(): Promise<void> {
  console.log("[media-service] Applying Drizzle migrations...");
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  console.log("[media-service] Migrations applied successfully.");
  await closeDb();
}

main().catch((error) => {
  console.error("[media-service] Migration failed:", error);
  process.exit(1);
});
