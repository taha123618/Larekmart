import { prisma } from "@repo/shipping-db";
import { ShippingCache } from "../cache/shipping-cache.js";
import { TrackingService } from "./tracking.service.js";
import { ShipmentRepository } from "../repositories/shipment.repository.js";
import { env } from "../config/env.js";
import type { ShipmentStatus as TypeShipmentStatus } from "@repo/types";

export interface CarrierWebhookInput {
  eventId?: string;
  trackingNumber: string;
  status: string; // carrier raw status
  description?: string;
  location?: string;
  timestamp?: string;
  signature?: string;
  rawPayload: Record<string, unknown>;
}

export class WebhookService {
  static verifySignature(carrier: string, signature?: string): boolean {
    if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
      return true; // relaxed in dev/test
    }
    if (!signature) return false;
    return signature === env.WEBHOOK_SECRET;
  }

  static mapCarrierStatusToDomain(rawStatus: string): TypeShipmentStatus {
    const s = rawStatus.toLowerCase().replace(/[\s_-]+/g, "");
    switch (s) {
      case "pickedup":
      case "pickup":
      case "collected":
        return "PICKED_UP";
      case "intransit":
      case "transit":
      case "dispatched":
      case "departed":
        return "IN_TRANSIT";
      case "outfordelivery":
      case "withcourier":
        return "OUT_FOR_DELIVERY";
      case "delivered":
      case "completed":
        return "DELIVERED";
      case "failed":
      case "undelivered":
      case "attemptfailed":
        return "FAILED";
      case "returned":
      case "return":
      case "rto":
        return "RETURNED";
      case "cancelled":
      case "void":
        return "CANCELLED";
      case "lost":
        return "LOST";
      default:
        return "IN_TRANSIT";
    }
  }

  static async processCarrierWebhook(
    carrier: string,
    input: CarrierWebhookInput,
  ): Promise<{ status: string; message: string }> {
    const eventId =
      input.eventId ?? `${carrier}_${input.trackingNumber}_${Date.now()}`;

    // 1. Idempotency Check in Redis & DB
    const alreadyProcessed = await ShippingCache.isWebhookProcessed(
      carrier,
      eventId,
    );
    if (alreadyProcessed) {
      return {
        status: "ignored",
        message: "Duplicate webhook event already processed",
      };
    }

    const existingInDb = await prisma.shippingWebhook.findFirst({
      where: { carrier, externalEventId: eventId },
    });
    if (existingInDb && existingInDb.status === "processed") {
      await ShippingCache.markWebhookProcessed(carrier, eventId);
      return {
        status: "ignored",
        message: "Duplicate webhook event already processed",
      };
    }

    // 2. Find shipment by tracking number
    const shipment = await ShipmentRepository.findByTrackingNumber(
      input.trackingNumber,
    );
    if (!shipment) {
      // Record webhook as ignored/unmatched
      await prisma.shippingWebhook.create({
        data: {
          carrier,
          externalEventId: eventId,
          signature: input.signature ?? null,
          payload: input.rawPayload as object,
          status: "ignored",
          errorMessage: `No shipment found matching tracking number '${input.trackingNumber}'`,
        },
      });
      return {
        status: "ignored",
        message: `No shipment found matching tracking number '${input.trackingNumber}'`,
      };
    }

    // 3. Map status and record tracking event
    const domainStatus = this.mapCarrierStatusToDomain(input.status);

    await TrackingService.recordTrackingEvent({
      shipmentId: shipment.id,
      status: domainStatus,
      description:
        input.description ?? `Carrier status update: ${input.status}`,
      location: input.location ?? null,
      occurredAt: input.timestamp ? new Date(input.timestamp) : new Date(),
      source: "carrier_webhook",
      metadata: input.rawPayload,
    });

    // 4. Record successful webhook processing
    await prisma.shippingWebhook.create({
      data: {
        carrier,
        externalEventId: eventId,
        signature: input.signature ?? null,
        payload: input.rawPayload as object,
        status: "processed",
        processedAt: new Date(),
      },
    });

    await ShippingCache.markWebhookProcessed(carrier, eventId);

    return {
      status: "processed",
      message: `Webhook successfully recorded for tracking number ${input.trackingNumber}`,
    };
  }
}
