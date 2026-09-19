import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { configureFastifyPlugins } from "./plugins/fastify.js";
import { healthRoutes } from "./routes/health.routes.js";
import { catalogRoutes } from "./routes/catalog.routes.js";

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Using @repo/monitoring logger
    disableRequestLogging: true,
  });

  // Plugins (CORS, Error Handlers)
  await configureFastifyPlugins(app);

  // Health & Metrics
  await app.register(healthRoutes);

  // API v1 Catalog Routes
  await app.register(catalogRoutes, { prefix: "/api/v1/catalog" });

  return app;
}
