import { startServer } from "./server.js";

startServer().catch((err: unknown) => {
  console.error("[return-service] Fatal startup error:", err);
  process.exit(1);
});
