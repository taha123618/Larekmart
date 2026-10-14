import { startServer } from "./server.js";

startServer().catch((err) => {
  console.error("Unhandled wishlist-service fatal error:", err);
  process.exit(1);
});
