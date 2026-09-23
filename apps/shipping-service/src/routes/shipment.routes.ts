import Router from "@koa/router";
import { ShipmentController } from "../controllers/shipment.controller.js";

export const shipmentRouter = new Router({ prefix: "/api/v1/shipments" });

shipmentRouter.get("/", ShipmentController.listShipments);
shipmentRouter.post("/", ShipmentController.createShipment);
shipmentRouter.get("/:id", ShipmentController.getShipment);
shipmentRouter.post("/:id/label", ShipmentController.createLabel);
shipmentRouter.post("/:id/cancel", ShipmentController.cancelShipment);
