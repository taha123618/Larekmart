import Router from "@koa/router";
import {
  DeliveryAttemptSchema,
  ReturnPickupSchema,
  ReturnPickupStatusSchema,
  getCourierPerformanceMetrics,
  getShipmentAttempts,
  recordDeliveryAttempt,
  scheduleReturnPickup,
  updateReturnPickupStatus,
} from "../services/shipping-operations.service.js";

export const shippingOperationsRouter = new Router({ prefix: "/api/v1/shipping" });

shippingOperationsRouter.post("/shipments/:id/attempts", async (ctx) => {
  const parsed = DeliveryAttemptSchema.safeParse(ctx.request.body ?? {});
  if (!parsed.success) {
    ctx.status = 400;
    ctx.body = { message: "Invalid delivery attempt payload", issues: parsed.error.issues };
    return;
  }
  const attempt = recordDeliveryAttempt(ctx.params.id!, parsed.data);
  ctx.status = 201;
  ctx.body = { attempt };
});

shippingOperationsRouter.get("/shipments/:id/attempts", async (ctx) => {
  ctx.body = { attempts: getShipmentAttempts(ctx.params.id!) };
});

shippingOperationsRouter.get("/couriers/performance", async (ctx) => {
  ctx.body = { couriers: getCourierPerformanceMetrics() };
});

shippingOperationsRouter.post("/return-pickups", async (ctx) => {
  const parsed = ReturnPickupSchema.safeParse(ctx.request.body ?? {});
  if (!parsed.success) {
    ctx.status = 400;
    ctx.body = { message: "Invalid return pickup payload", issues: parsed.error.issues };
    return;
  }
  const pickup = scheduleReturnPickup(parsed.data);
  ctx.status = 201;
  ctx.body = { pickup };
});

shippingOperationsRouter.patch("/return-pickups/:id", async (ctx) => {
  const parsed = ReturnPickupStatusSchema.safeParse(ctx.request.body ?? {});
  if (!parsed.success) {
    ctx.status = 400;
    ctx.body = { message: "Invalid status payload", issues: parsed.error.issues };
    return;
  }
  try {
    const pickup = updateReturnPickupStatus(ctx.params.id!, parsed.data.status);
    ctx.body = { pickup };
  } catch (err: unknown) {
    ctx.status = 404;
    ctx.body = { message: err instanceof Error ? err.message : "Pickup not found" };
  }
});
