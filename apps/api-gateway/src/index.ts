import { startServer } from "./server.js";
import { logger } from "./observability/logger.js";

startServer().catch((err) => {
  logger.fatal("Unhandled fatal error during gateway bootstrap", {
    error: String(err),
  });
  process.exit(1);
});
