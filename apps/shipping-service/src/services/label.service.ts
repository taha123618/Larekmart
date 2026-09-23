import { ShipmentRepository } from "../repositories/shipment.repository.js";
import { ProviderRegistry } from "../providers/registry.js";
import { ShippingPublisher } from "../publishers/shipping.publisher.js";
import type { ShippingLabel, CreateLabelRequest } from "@repo/types";

export class LabelService {
  static async generateLabel(
    request: CreateLabelRequest,
  ): Promise<ShippingLabel> {
    const shipment = await ShipmentRepository.findById(request.shipmentId);
    if (!shipment) {
      throw new Error(`Shipment with id '${request.shipmentId}' not found`);
    }

    if (!shipment.trackingNumber) {
      throw new Error(
        `Shipment '${request.shipmentId}' does not have a tracking number yet. Ensure carrier booking is complete.`,
      );
    }

    // Check if label already exists
    const existingLabel = shipment.labels?.[0];
    if (existingLabel) {
      return {
        id: existingLabel.id,
        shipmentId: existingLabel.shipmentId,
        carrier: existingLabel.carrier,
        trackingNumber: existingLabel.trackingNumber,
        format: existingLabel.format as "pdf" | "zpl" | "png",
        labelUrl: existingLabel.labelUrl,
        cost: existingLabel.cost,
        createdAt: existingLabel.createdAt.toISOString(),
      };
    }

    // Request from carrier provider adapter
    const provider = ProviderRegistry.getProvider(shipment.carrier);
    const labelResult = await provider.createLabel({
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber,
      format: request.format,
    });

    // Store in DB
    const saved = await ShipmentRepository.addLabel({
      shipmentId: shipment.id,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      format: labelResult.format,
      labelUrl: labelResult.labelUrl,
      cost: labelResult.cost,
    });

    // Publish label created event
    await ShippingPublisher.publishLabelCreated({
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      trackingNumber: shipment.trackingNumber,
      carrier: shipment.carrier,
      labelUrl: saved.labelUrl,
    });

    return {
      id: saved.id,
      shipmentId: saved.shipmentId,
      carrier: saved.carrier,
      trackingNumber: saved.trackingNumber,
      format: saved.format as "pdf" | "zpl" | "png",
      labelUrl: saved.labelUrl,
      cost: saved.cost,
      createdAt: saved.createdAt.toISOString(),
    };
  }
}
