import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { healthRoutes } from "./routes/health.routes.js";
import { storefrontRoutes } from "./routes/storefront.routes.js";
import { sellerRoutes } from "./routes/seller.routes.js";
import { adminSellerRoutes } from "./routes/admin.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV === "development",
  });

  // 1. CORS Configuration
  await app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "x-user-id",
      "x-user-role",
      "x-user-name",
      "x-internal-secret",
    ],
    credentials: true,
  });

  // 2. Defensive HTTP Security Headers
  app.addHook("onSend", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("X-XSS-Protection", "1; mode=block");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  });

  // 3. Global Error Handler
  app.setErrorHandler(errorHandler);

  // 4. Register Routes
  await app.register(healthRoutes);
  await app.register(storefrontRoutes);
  await app.register(sellerRoutes);
  await app.register(adminSellerRoutes);

  return app;
}
