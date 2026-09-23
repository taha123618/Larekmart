import type { Context } from "koa";
import { TrackingService } from "../services/tracking.service.js";

export class TrackingController {
  static async getShipmentTracking(ctx: Context): Promise<void> {
    const shipmentId = ctx.params.id;
    if (!shipmentId) {
      ctx.status = 400;
      ctx.body = { message: "Shipment ID parameter is required" };
      return;
    }

    try {
      const tracking = await TrackingService.getTracking(shipmentId);
      ctx.status = 200;
      ctx.body = tracking;
    } catch (err) {
      ctx.status = 404;
      ctx.body = {
        message: err instanceof Error ? err.message : "Tracking not found",
      };
    }
  }

  static async getTrackingByNumber(ctx: Context): Promise<void> {
    const trackingNumber = ctx.params.trackingNumber;
    if (!trackingNumber) {
      ctx.status = 400;
      ctx.body = { message: "Tracking number parameter is required" };
      return;
    }

    try {
      const tracking = await TrackingService.getTracking(trackingNumber);
      ctx.status = 200;
      ctx.body = tracking;
    } catch (err) {
      ctx.status = 404;
      ctx.body = {
        message: err instanceof Error ? err.message : "Tracking not found",
      };
    }
  }
}
