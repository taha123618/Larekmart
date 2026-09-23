import { ShipmentRepository } from "../repositories/shipment.repository.js";
import { ShippingPublisher } from "../publishers/shipping.publisher.js";
import { ShippingCache } from "../cache/shipping-cache.js";
import { ShipmentStatus } from "@repo/shipping-db";
import type {
  TrackingResult,
  TrackingEvent,
  ShipmentStatus as TypeShipmentStatus,
} from "@repo/types";

export class TrackingService {
  static async recordTrackingEvent(data: {
    shipmentId: string;
    status: TypeShipmentStatus;
    description: string;
    location?: string | null;
    occurredAt?: Date;
    source?: "carrier_webhook" | "carrier_poll" | "manual";
    metadata?: Record<string, unknown>;
  }): Promise<TrackingEvent> {
    const shipment = await ShipmentRepository.findById(data.shipmentId);
    if (!shipment) {
      throw new Error(`Shipment with id '${data.shipmentId}' not found`);
    }

    const prismaStatus = data.status as unknown as ShipmentStatus;

    // 1. Insert tracking event
    const event = await ShipmentRepository.addTrackingEvent({
      shipmentId: data.shipmentId,
      status: prismaStatus,
      description: data.description,
      location: data.location,
      occurredAt: data.occurredAt,
      source: data.source,
      metadata: data.metadata,
    });

    // 2. Update shipment status and dates
    const extraUpdates: {
      shippedAt?: Date;
      deliveredAt?: Date;
      codStatus?: string;
    } = {};

    if (data.status === "PICKED_UP" || data.status === "IN_TRANSIT") {
      if (!shipment.shippedAt) {
        extraUpdates.shippedAt = data.occurredAt ?? new Date();
      }
    } else if (data.status === "DELIVERED") {
      extraUpdates.deliveredAt = data.occurredAt ?? new Date();
      if (shipment.isCod && shipment.codStatus === "PENDING_COLLECTION") {
        extraUpdates.codStatus = "COLLECTED";
      }
    } else if (data.status === "RETURNED" || data.status === "FAILED") {
      if (shipment.isCod && shipment.codStatus === "PENDING_COLLECTION") {
        extraUpdates.codStatus = "REFUSED";
      }
    }

    await ShipmentRepository.updateStatus(
      shipment.id,
      prismaStatus,
      extraUpdates,
    );

    // 3. Invalidate Redis tracking cache
    if (shipment.trackingNumber) {
      await ShippingCache.invalidateTracking(shipment.trackingNumber);
    }

    // 4. Publish Kafka events
    if (shipment.trackingNumber) {
      await ShippingPublisher.publishTrackingUpdated({
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        carrier: shipment.carrier,
        status: data.status,
        description: data.description,
        location: data.location,
        occurredAt: data.occurredAt ?? new Date(),
      });

      if (data.status === "IN_TRANSIT") {
        await ShippingPublisher.publishInTransit({
          shipmentId: shipment.id,
          orderId: shipment.orderId,
          trackingNumber: shipment.trackingNumber,
          carrier: shipment.carrier,
          location: data.location,
        });
      } else if (data.status === "OUT_FOR_DELIVERY") {
        await ShippingPublisher.publishOutForDelivery({
          shipmentId: shipment.id,
          orderId: shipment.orderId,
          trackingNumber: shipment.trackingNumber,
          carrier: shipment.carrier,
        });
      } else if (data.status === "DELIVERED") {
        await ShippingPublisher.publishDelivered({
          shipmentId: shipment.id,
          orderId: shipment.orderId,
          trackingNumber: shipment.trackingNumber,
          carrier: shipment.carrier,
          deliveredAt: extraUpdates.deliveredAt,
        });
      }
    }

    return {
      id: event.id,
      shipmentId: event.shipmentId,
      status: event.status as TypeShipmentStatus,
      description: event.description,
      location: event.location,
      occurredAt: event.occurredAt.toISOString(),
      source: event.source as "carrier_webhook" | "carrier_poll" | "manual",
      metadata: event.metadata as Record<string, unknown> | null,
    };
  }

  static async getTracking(
    trackingNumberOrId: string,
  ): Promise<TrackingResult> {
    // 1. Try finding by tracking number
    let shipment =
      await ShipmentRepository.findByTrackingNumber(trackingNumberOrId);
    if (!shipment) {
      // Try by shipment UUID
      shipment = await ShipmentRepository.findById(trackingNumberOrId);
    }

    if (!shipment) {
      throw new Error(
        `Shipment with identifier '${trackingNumberOrId}' not found`,
      );
    }

    const trkNumber = shipment.trackingNumber ?? "PENDING";

    // Check Redis cache if tracking number exists
    if (shipment.trackingNumber) {
      const cached = await ShippingCache.getCachedTracking(
        shipment.trackingNumber,
      );
      if (cached) {
        return cached;
      }
    }

    const result: TrackingResult = {
      shipmentId: shipment.id,
      carrier: shipment.carrier,
      trackingNumber: trkNumber,
      status: shipment.status as TypeShipmentStatus,
      estimatedDeliveryAt: shipment.estimatedDeliveryAt?.toISOString() ?? null,
      isCod: shipment.isCod,
      codAmount: shipment.codAmount ? Number(shipment.codAmount) : null,
      codStatus: shipment.codStatus,
      events: shipment.trackingEvents.map((e) => ({
        id: e.id,
        shipmentId: e.shipmentId,
        status: e.status as TypeShipmentStatus,
        description: e.description,
        location: e.location,
        occurredAt: e.occurredAt.toISOString(),
        source: e.source as "carrier_webhook" | "carrier_poll" | "manual",
        metadata: e.metadata as Record<string, unknown> | null,
      })),
      lastUpdated: shipment.updatedAt.toISOString(),
    };

    if (shipment.trackingNumber) {
      await ShippingCache.setCachedTracking(shipment.trackingNumber, result);
    }

    return result;
  }
}
