import crypto from "node:crypto";
import { prisma } from "@repo/shipping-db";
import { ShippingCache } from "../cache/shipping-cache.js";
import { TrackingService } from "./tracking.service.js";
import { ShipmentRepository } from "../repositories/shipment.repository.js";
import { env, DEFAULT_WEBHOOK_SECRET } from "../config/env.js";
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
  static verifySignature(
    carrier: string,
    signature?: string,
    rawBody?: string,
  ): boolean {
    // Signatures are mandatory in EVERY environment. An unsigned request must
    // never be treated as authenticated — there is no development fail-open.
    if (!signature) return false;

    const secret = process.env.WEBHOOK_SECRET || env.WEBHOOK_SECRET;
    // The schema-default placeholder never authenticates: a deployment that
    // forgot to configure WEBHOOK_SECRET fails closed, not open.
    if (!secret || secret === DEFAULT_WEBHOOK_SECRET) return false;
    try {
      // 1. If rawBody is provided, verify cryptographic HMAC-SHA256 payload binding
      if (rawBody && typeof rawBody === "string") {
        const computedHmac = crypto
          .createHmac("sha256", secret)
          .update(rawBody)
          .digest("hex");
        const sigBuf = Buffer.from(signature, "utf8");
        const expBuf = Buffer.from(computedHmac, "utf8");
        if (
          sigBuf.length === expBuf.length &&
          crypto.timingSafeEqual(sigBuf, expBuf)
        ) {
          return true;
        }
      }

      // 2. Fall back to constant-time pre-shared token comparison for backward-compatibility
      const sigHash = crypto.createHash("sha256").update(signature).digest();
      const secretHash = crypto.createHash("sha256").update(secret).digest();
      return crypto.timingSafeEqual(sigHash, secretHash);
    } catch {
      return false;
    }
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
