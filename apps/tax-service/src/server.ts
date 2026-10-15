import Fastify from "fastify";
import type {
  FastifyInstance,
  FastifyError,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import cors from "@fastify/cors";
import { clerkPlugin } from "@clerk/fastify";
import { env } from "./config/env.js";
import { healthRoutes } from "./routes/health.routes.js";
import { taxRoutes } from "./routes/tax.routes.js";
import { adminTaxRoutes } from "./routes/admin-tax.routes.js";

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
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

  // 3. Clerk Authentication Plugin
  if (env.CLERK_SECRET_KEY && !env.CLERK_SECRET_KEY.includes("placeholder")) {
    try {
      await app.register(clerkPlugin, {
        publishableKey: env.CLERK_PUBLISHABLE_KEY,
        secretKey: env.CLERK_SECRET_KEY,
      });
    } catch (err) {
      console.warn("Clerk plugin deferred/warning in tax-service:", err);
    }
  }

  // 4. Global Structured Error Handler (Mandatory { message } JSON)
  app.setErrorHandler(
    (error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
      const statusCode = error.statusCode || 500;
      const message = error.message || "Internal server error";

      if (statusCode >= 500) {
        console.error("[ServerError in tax-service]", error);
      }

      reply.status(statusCode).send({ message });
    },
  );

  // 5. Register Routes
  await app.register(healthRoutes);
  await app.register(taxRoutes);
  await app.register(adminTaxRoutes);

  return app;
}
