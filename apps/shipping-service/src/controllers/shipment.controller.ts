import type { Context } from "koa";
import { ShipmentService } from "../services/shipment.service.js";
import { LabelService } from "../services/label.service.js";
import { TrackingService } from "../services/tracking.service.js";
import {
  CreateShipmentRequestSchema,
  CreateLabelRequestSchema,
  UpdateShipmentLocationSchema,
} from "@repo/types";

export class ShipmentController {
  static async listShipments(ctx: Context): Promise<void> {
    const { page, limit, carrier, status, search, isCod, codStatus } =
      ctx.query;
    try {
      const result = await ShipmentService.listShipments({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        carrier: typeof carrier === "string" ? carrier : undefined,
        status: typeof status === "string" ? status : undefined,
        search: typeof search === "string" ? search : undefined,
        isCod:
          isCod !== undefined ? isCod === "true" || isCod === "1" : undefined,
        codStatus: typeof codStatus === "string" ? codStatus : undefined,
      });
      ctx.status = 200;
      ctx.body = result;
    } catch (err) {
      ctx.status = 500;
      ctx.body = {
        message:
          err instanceof Error ? err.message : "Failed to list shipments",
      };
    }
  }

  static async createShipment(ctx: Context): Promise<void> {
    const parsed = CreateShipmentRequestSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        message: "Invalid shipment creation payload",
        errors: parsed.error.issues,
      };
      return;
    }

    try {
      const shipment = await ShipmentService.createShipment(parsed.data);
      ctx.status = 201;
      ctx.body = shipment;
    } catch (err) {
      ctx.status = 500;
      ctx.body = {
        message:
          err instanceof Error ? err.message : "Failed to create shipment",
      };
    }
  }

  static async getShipment(ctx: Context): Promise<void> {
    const id = ctx.params.id;
    if (!id) {
      ctx.status = 400;
      ctx.body = { message: "Shipment ID parameter is required" };
      return;
    }

    try {
      const shipment = await ShipmentService.getShipmentById(id);
      ctx.status = 200;
      ctx.body = shipment;
    } catch (err) {
      ctx.status = 404;
      ctx.body = {
        message: err instanceof Error ? err.message : "Shipment not found",
      };
    }
  }

  static async createLabel(ctx: Context): Promise<void> {
    const id = ctx.params.id;
    const body = (ctx.request.body as Record<string, unknown>) ?? {};
    const parsed = CreateLabelRequestSchema.safeParse({
      shipmentId: id,
      format: body.format ?? "pdf",
    });

    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        message: "Invalid label request",
        errors: parsed.error.issues,
      };
      return;
    }

    try {
      const label = await LabelService.generateLabel(parsed.data);
      ctx.status = 200;
      ctx.body = label;
    } catch (err) {
      ctx.status = 500;
      ctx.body = {
        message:
          err instanceof Error ? err.message : "Failed to generate label",
      };
    }
  }

  static async cancelShipment(ctx: Context): Promise<void> {
    const id = ctx.params.id;
    const body = (ctx.request.body as Record<string, unknown>) ?? {};
    const reason = typeof body.reason === "string" ? body.reason : undefined;

    try {
      const shipment = await ShipmentService.cancelShipment(id, reason);
      ctx.status = 200;
      ctx.body = shipment;
    } catch (err) {
      ctx.status = 400;
      ctx.body = {
        message:
          err instanceof Error ? err.message : "Failed to cancel shipment",
      };
    }
  }

  static async updateLocation(ctx: Context): Promise<void> {
    const id = ctx.params.id;
    const body = (ctx.request.body as Record<string, unknown>) ?? {};
    const parsed = UpdateShipmentLocationSchema.safeParse({
      ...body,
      shipmentId: id,
    });

    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        message: "Invalid location update payload",
        errors: parsed.error.issues,
      };
      return;
    }

    try {
      const event = await TrackingService.recordTrackingEvent({
        shipmentId: id,
        status: parsed.data.status,
        description: parsed.data.description,
        location: parsed.data.location,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        heading: parsed.data.heading,
        accuracyMeters: parsed.data.accuracyMeters,
        etaMinutes: parsed.data.etaMinutes,
        source: parsed.data.source,
      });

      ctx.status = 201;
      ctx.body = {
        success: true,
        message: "Shipment location updated and tracking event broadcasted",
        event,
      };
    } catch (err) {
      ctx.status = 400;
      ctx.body = {
        message:
          err instanceof Error
            ? err.message
            : "Failed to update shipment location",
      };
    }
  }
}
