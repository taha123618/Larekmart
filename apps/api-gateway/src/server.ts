import Fastify, { type FastifyInstance } from "fastify";
import { registerRequestIdMiddleware } from "./middleware/request-id.js";
import { registerSecurityMiddleware } from "./middleware/security.js";
import { registerCorsMiddleware } from "./middleware/cors.js";
import { registerRateLimitMiddleware } from "./middleware/rate-limit.js";
import { registerAuthMiddleware } from "./middleware/auth.js";
import { globalErrorHandler } from "./middleware/error-handler.js";
import { livenessHandler } from "./health/live.js";
import { readinessHandler } from "./health/ready.js";
import { registerProxyRoutes } from "./proxy/proxy.js";
import { metrics } from "./observability/metrics.js";

export async function buildGatewayServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
    trustProxy: true,
  });

  // 1. Error Handler
  app.setErrorHandler(globalErrorHandler);

  // 2. Correlation & Header Sanitization
  registerRequestIdMiddleware(app);

  // 3. Defensive Security Headers
  await registerSecurityMiddleware(app);

  // 4. Centralized CORS
  await registerCorsMiddleware(app);

  // 5. Distributed / Local Rate Limiting
  await registerRateLimitMiddleware(app);

  // 6. Clerk Authentication & Session Claim Resolution
  await registerAuthMiddleware(app);

  // 7. Health & Telemetry Endpoints
  app.get("/health", livenessHandler);
  app.get("/health/live", livenessHandler);
  app.get("/health/ready", readinessHandler);
  app.get("/metrics", async (_request, reply) => {
    return reply
      .header("Content-Type", "text/plain; version=0.0.4")
      .send(metrics.toPrometheus());
  });

  // 8. Register Microservice Proxy Upstreams
  await registerProxyRoutes(app);

  return app;
}
