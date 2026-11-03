import Fastify from "fastify";
import cors from "@fastify/cors";
import { internalCommissionRoutes } from "./routes/internal.routes.js";
import { adminCommissionRoutes } from "./routes/admin.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { env } from "./config/env.js";

export function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  app.setErrorHandler(errorHandler);

  app.register(cors, {
    origin: [env.CLIENT_URL, env.ADMIN_URL],
    credentials: true,
  });

  // Health and metrics
  app.register(healthRoutes);

  // Business domain routes
  app.register(internalCommissionRoutes, { prefix: "/api/v1/internal/commissions" });
  app.register(adminCommissionRoutes, { prefix: "/api/v1/admin/commissions" });

  return app;
}
