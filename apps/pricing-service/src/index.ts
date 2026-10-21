import { startServer } from "./server.js";

startServer().catch((err) => {
  console.error("Unhandled pricing-service fatal error:", err);
  process.exit(1);
});
