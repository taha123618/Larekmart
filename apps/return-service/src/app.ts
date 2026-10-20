import Koa from "koa";
import bodyParser from "koa-bodyparser";
import cors from "@koa/cors";
import { env } from "./config/env.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { healthRoutes } from "./routes/health.routes.js";
import { customerRoutes } from "./routes/customer.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";

export function createApp(): Koa {
  const app = new Koa();

  // Trust X-Forwarded-* headers from the API gateway
  app.proxy = true;

  // Global error handler — must be first middleware
  app.use(errorMiddleware);

  // CORS — allow the frontends and API gateway
  app.use(
    cors({
      origin: (ctx) => {
        const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
        const requestOrigin = ctx.request.headers.origin;
        if (requestOrigin && allowed.includes(requestOrigin)) {
          return requestOrigin;
        }
        return allowed[0] ?? "*";
      },
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "x-user-id", "x-user-role", "x-internal-secret"],
      credentials: true,
    }),
  );

  // JSON body parser
  app.use(
    bodyParser({
      enableTypes: ["json"],
      jsonLimit: "2mb",
      onerror(err, ctx) {
        ctx.throw(400, `Invalid JSON body: ${err.message}`);
      },
    }),
  );

  // Mount routes
  app.use(healthRoutes.routes()).use(healthRoutes.allowedMethods());
  app.use(customerRoutes.routes()).use(customerRoutes.allowedMethods());
  app.use(adminRoutes.routes()).use(adminRoutes.allowedMethods());

  return app;
}
