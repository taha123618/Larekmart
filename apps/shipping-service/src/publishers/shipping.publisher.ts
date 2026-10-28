import { producer } from "../utils/kafka.js";
import { v4 as uuidv4 } from "uuid";
import type {
  ShipmentStatus,
  ShipmentCreatedPayload,
  ShipmentLabelCreatedPayload,
  ShipmentShippedPayload,
  ShipmentInTransitPayload,
  ShipmentOutForDeliveryPayload,
  ShipmentDeliveredPayload,
  ShipmentCancelledPayload,
  ShipmentFailedPayload,
  TrackingUpdatedPayload,
} from "@repo/types";

export class ShippingPublisher {
  private static async safeSend(
    topic: string,
    payload: unknown,
  ): Promise<void> {
    try {
      await producer.send(topic, { value: payload });
    } catch (err) {
      console.warn(
        `[ShippingPublisher] Failed to publish to topic '${topic}':`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  static async publishShipmentCreated(data: {
    shipmentId: string;
    orderId: string;
    userId?: string | null;
    carrier: string;
    trackingNumber?: string | null;
    status: ShipmentStatus;
    shippingRateAmount: number;
    currency: string;
    isCod?: boolean;
    codAmount?: number | null;
    codFee?: number | null;
    codStatus?: string | null;
  }): Promise<void> {
    const payload: ShipmentCreatedPayload = {
      eventId: uuidv4(),
      eventType: "shipment.created",
      shipmentId: data.shipmentId,
      orderId: data.orderId,
      userId: data.userId,
      carrier: data.carrier,
      trackingNumber: data.trackingNumber,
      status: data.status,
      shippingRateAmount: data.shippingRateAmount,
      currency: data.currency,
      isCod: data.isCod,
      codAmount: data.codAmount,
      codFee: data.codFee,
      codStatus: data.codStatus,
      timestamp: new Date().toISOString(),
    };

    await this.safeSend("shipment.created", payload);
  }

  static async publishLabelCreated(data: {
    shipmentId: string;
    orderId: string;
    trackingNumber: string;
    carrier: string;
    labelUrl: string;
  }): Promise<void> {
    const payload: ShipmentLabelCreatedPayload = {
      eventId: uuidv4(),
      eventType: "shipment.label_created",
      shipmentId: data.shipmentId,
      orderId: data.orderId,
      trackingNumber: data.trackingNumber,
      carrier: data.carrier,
      labelUrl: data.labelUrl,
      timestamp: new Date().toISOString(),
    };

    await this.safeSend("shipment.label_created", payload);
  }

  static async publishReturnLabelCreated(data: {
    returnId: string;
    shipmentId: string;
    trackingNumber: string;
    carrierName: string;
    labelUrl: string;
  }): Promise<void> {
    await this.safeSend("shipping.label.created", {
      returnId: data.returnId,
      shipmentId: data.shipmentId,
      trackingNumber: data.trackingNumber,
      carrierName: data.carrierName,
      labelUrl: data.labelUrl,
      createdAt: new Date().toISOString(),
    });
  }

  static async publishShipped(data: {
    shipmentId: string;
    orderId: string;
    trackingNumber: string;
    carrier: string;
    shippedAt?: Date | string;
  }): Promise<void> {
    const payload: ShipmentShippedPayload = {
      eventId: uuidv4(),
      eventType: "shipment.shipped",
      shipmentId: data.shipmentId,
      orderId: data.orderId,
      trackingNumber: data.trackingNumber,
      carrier: data.carrier,
      shippedAt: (data.shippedAt
        ? new Date(data.shippedAt)
        : new Date()
      ).toISOString(),
      timestamp: new Date().toISOString(),
    };

    await this.safeSend("shipment.shipped", payload);
  }

  static async publishInTransit(data: {
    shipmentId: string;
    orderId: string;
    trackingNumber: string;
    carrier: string;
    location?: string | null;
  }): Promise<void> {
    const payload: ShipmentInTransitPayload = {
      eventId: uuidv4(),
      eventType: "shipment.in_transit",
      shipmentId: data.shipmentId,
      orderId: data.orderId,
      trackingNumber: data.trackingNumber,
      carrier: data.carrier,
      location: data.location,
      timestamp: new Date().toISOString(),
    };

    await this.safeSend("shipment.in_transit", payload);
  }

  static async publishOutForDelivery(data: {
    shipmentId: string;
    orderId: string;
    trackingNumber: string;
    carrier: string;
  }): Promise<void> {
    const payload: ShipmentOutForDeliveryPayload = {
      eventId: uuidv4(),
      eventType: "shipment.out_for_delivery",
      shipmentId: data.shipmentId,
      orderId: data.orderId,
      trackingNumber: data.trackingNumber,
      carrier: data.carrier,
      timestamp: new Date().toISOString(),
    };

    await this.safeSend("shipment.out_for_delivery", payload);
  }

  static async publishDelivered(data: {
    shipmentId: string;
    orderId: string;
    trackingNumber: string;
    carrier: string;
    deliveredAt?: Date | string;
  }): Promise<void> {
    const payload: ShipmentDeliveredPayload = {
      eventId: uuidv4(),
      eventType: "shipment.delivered",
      shipmentId: data.shipmentId,
      orderId: data.orderId,
      trackingNumber: data.trackingNumber,
      carrier: data.carrier,
      deliveredAt: (data.deliveredAt
        ? new Date(data.deliveredAt)
        : new Date()
      ).toISOString(),
      timestamp: new Date().toISOString(),
    };

    await this.safeSend("shipment.delivered", payload);
  }

  static async publishCancelled(data: {
    shipmentId: string;
    orderId: string;
    reason?: string;
  }): Promise<void> {
    const payload: ShipmentCancelledPayload = {
      eventId: uuidv4(),
      eventType: "shipment.cancelled",
      shipmentId: data.shipmentId,
      orderId: data.orderId,
      reason: data.reason,
      timestamp: new Date().toISOString(),
    };

    await this.safeSend("shipment.cancelled", payload);
  }

  static async publishFailed(data: {
    shipmentId: string;
    orderId: string;
    reason?: string;
  }): Promise<void> {
    const payload: ShipmentFailedPayload = {
      eventId: uuidv4(),
      eventType: "shipment.failed",
      shipmentId: data.shipmentId,
      orderId: data.orderId,
      reason: data.reason,
      timestamp: new Date().toISOString(),
    };

    await this.safeSend("shipment.failed", payload);
  }

  static async publishTrackingUpdated(data: {
    shipmentId: string;
    trackingNumber: string;
    carrier: string;
    status: ShipmentStatus;
    description: string;
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    heading?: number | null;
    etaMinutes?: number | null;
    occurredAt: Date | string;
  }): Promise<void> {
    const payload: TrackingUpdatedPayload = {
      eventId: uuidv4(),
      eventType: "tracking.updated",
      shipmentId: data.shipmentId,
      trackingNumber: data.trackingNumber,
      carrier: data.carrier,
      status: data.status,
      description: data.description,
      location: data.location,
      latitude: data.latitude,
      longitude: data.longitude,
      heading: data.heading,
      etaMinutes: data.etaMinutes,
      occurredAt: new Date(data.occurredAt).toISOString(),
      timestamp: new Date().toISOString(),
    };

    await this.safeSend("tracking.updated", payload);
    await this.safeSend("shipping.tracking.updated", payload);
  }
}
