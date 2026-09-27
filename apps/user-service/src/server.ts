import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { configureFastifyPlugins } from "./plugins/fastify.js";
import { healthRoutes } from "./routes/health.routes.js";
import { userRoutes } from "./routes/user.routes.js";

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Using @repo/monitoring logger
    disableRequestLogging: true,
  });

  // Plugins (CORS, Clerk, Monitoring, Error Handlers)
  await configureFastifyPlugins(app);

  // Health & Metrics
  await app.register(healthRoutes);

  // API v1 User Routes
  await app.register(userRoutes, { prefix: "/api/v1/users" });

  return app;
}
