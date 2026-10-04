import Fastify, { type FastifyInstance } from "fastify";
import { registerRequestIdMiddleware } from "./middleware/request-id.js";
import { registerTracingMiddleware } from "./middleware/tracing.js";
import { registerSecurityMiddleware } from "./middleware/security.js";
import { registerCorsMiddleware } from "./middleware/cors.js";
import { registerRateLimitMiddleware } from "./middleware/rate-limit.js";
import { registerAuthMiddleware } from "./auth/auth-middleware.js";
import { globalErrorHandler } from "./middleware/error-handler.js";
import { livenessHandler } from "./health/live.js";
import { readinessHandler } from "./health/ready.js";
import { registerProxyRoutes } from "./gateway/proxy.js";
import { homeAggregationRoutes } from "./aggregation/home.js";
import {
  metrics,
  gatewayRequestsTotal,
  gatewayRequestDurationSeconds,
  gateway4xxTotal,
  gateway5xxTotal,
} from "./observability/metrics.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
    trustProxy: true,
    bodyLimit: 5 * 1024 * 1024, // 5MB body limit
  });

  // 1. Centralized Error Handler
  app.setErrorHandler(globalErrorHandler);

  // Request telemetry metrics
  app.addHook("onRequest", async (request) => {
    gatewayRequestsTotal.inc({ method: request.method, route: request.url });
  });

  app.addHook("onResponse", async (request, reply) => {
    const elapsed = reply.elapsedTime / 1000;
    gatewayRequestDurationSeconds.observe(
      {
        method: request.method,
        status: String(reply.statusCode),
      },
      elapsed,
    );

    if (reply.statusCode >= 400 && reply.statusCode < 500) {
      gateway4xxTotal.inc({ method: request.method, status: String(reply.statusCode) });
    } else if (reply.statusCode >= 500) {
      gateway5xxTotal.inc({ method: request.method, status: String(reply.statusCode) });
    }
  });

  // 2. Correlation & Header Sanitization
  registerRequestIdMiddleware(app);

  // 3. Distributed Tracing & W3C Trace Context
  registerTracingMiddleware(app);

  // 4. Defensive Security Headers
  await registerSecurityMiddleware(app);

  // 5. Centralized CORS
  await registerCorsMiddleware(app);

  // 6. Distributed / Local Rate Limiting
  await registerRateLimitMiddleware(app);

  // 7. Clerk Authentication & Session Claim Resolution
  await registerAuthMiddleware(app);

  // 8. Health & Telemetry Endpoints
  app.get("/health", livenessHandler);
  app.get("/health/live", livenessHandler);
  app.get("/health/ready", readinessHandler);
  app.get("/metrics", async (_request, reply) => {
    return reply
      .header("Content-Type", "text/plain; version=0.0.4")
      .send(metrics.toPrometheus());
  });

  // 9. Aggregation Routes (Read-only bounded home aggregations)
  await app.register(homeAggregationRoutes);

  // 10. Register Microservice Proxy Upstreams
  await registerProxyRoutes(app);

  return app;
}

export const buildGatewayServer = buildApp;
