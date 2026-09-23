import Router from "@koa/router";
import { TrackingController } from "../controllers/tracking.controller.js";

export const trackingRouter = new Router({ prefix: "/api/v1" });

trackingRouter.get(
  "/shipments/:id/tracking",
  TrackingController.getShipmentTracking,
);
trackingRouter.get(
  "/tracking/:trackingNumber",
  TrackingController.getTrackingByNumber,
);
