import { startServer } from "./server.js";

startServer().catch((err) => {
  console.error("[SellerService] Fatal startup failure:", err);
  process.exit(1);
});
