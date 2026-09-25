import Koa from "koa";
import bodyParser from "koa-bodyparser";
import cors from "@koa/cors";
import { healthRouter } from "./routes/health.routes.js";
import { shippingRouter } from "./routes/shipping.routes.js";
import { shipmentRouter } from "./routes/shipment.routes.js";
import { trackingRouter } from "./routes/tracking.routes.js";
import { webhookRouter } from "./routes/webhook.routes.js";

export function createServer(): Koa {
  const app = new Koa();

  // 1. Error Handling Middleware
  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (err: unknown) {
      const error = err as {
        status?: number;
        statusCode?: number;
        message?: string;
      };
      const status = error.status || error.statusCode || 500;
      const message = error.message || "Internal Server Error";

      console.error(
        `[Error] ${ctx.method} ${ctx.url} - ${status}: ${message}`,
        err,
      );

      ctx.status = status;
      ctx.body = { message };
    }
  });

  // 2. Request Timing Logger
  app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.set("X-Response-Time", `${ms}ms`);
    if (ctx.url !== "/api/v1/health/live" && ctx.url !== "/api/v1/health") {
      console.log(`[HTTP] ${ctx.method} ${ctx.url} ${ctx.status} - ${ms}ms`);
    }
  });

  // 3. Security Headers Middleware
  app.use(async (ctx, next) => {
    ctx.set("X-Content-Type-Options", "nosniff");
    ctx.set("X-Frame-Options", "DENY");
    ctx.set("X-XSS-Protection", "1; mode=block");
    ctx.set("Referrer-Policy", "strict-origin-when-cross-origin");
    await next();
  });

  // 4. CORS and Body Parsing
  const allowedOrigins = [
    process.env.CLIENT_URL || "http://localhost:3002",
    process.env.ADMIN_URL || "http://localhost:3003",
  ];

  app.use(
    cors({
      origin: (ctx) => {
        const requestOrigin = ctx.get("Origin");
        if (allowedOrigins.includes(requestOrigin)) {
          return requestOrigin;
        }
        return allowedOrigins[0] || "http://localhost:3002";
      },
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "x-request-id",
        "X-Request-ID",
        "x-internal-secret",
        "X-Internal-Secret",
      ],
    }),
  );
  app.use(
    bodyParser({
      enableTypes: ["json", "form"],
      jsonLimit: "5mb",
    }),
  );

  // 4. Routes Mounting
  app.use(healthRouter.routes()).use(healthRouter.allowedMethods());
  app.use(shippingRouter.routes()).use(shippingRouter.allowedMethods());
  app.use(shipmentRouter.routes()).use(shipmentRouter.allowedMethods());
  app.use(trackingRouter.routes()).use(trackingRouter.allowedMethods());
  app.use(webhookRouter.routes()).use(webhookRouter.allowedMethods());

  return app;
}
