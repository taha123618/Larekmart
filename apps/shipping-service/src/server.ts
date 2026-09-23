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

  // 3. CORS and Body Parsing
  app.use(cors());
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
