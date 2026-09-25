import Router from "@koa/router";
import { ShipmentController } from "../controllers/shipment.controller.js";
import { requireAdminOrInternal } from "../middleware/auth.middleware.js";

export const shipmentRouter = new Router({ prefix: "/api/v1/shipments" });

shipmentRouter.get(
  "/",
  requireAdminOrInternal,
  ShipmentController.listShipments,
);
shipmentRouter.post(
  "/",
  requireAdminOrInternal,
  ShipmentController.createShipment,
);
shipmentRouter.get(
  "/:id",
  requireAdminOrInternal,
  ShipmentController.getShipment,
);
shipmentRouter.post(
  "/:id/label",
  requireAdminOrInternal,
  ShipmentController.createLabel,
);
shipmentRouter.post(
  "/:id/cancel",
  requireAdminOrInternal,
  ShipmentController.cancelShipment,
);
