import type {
  ShippingProvider,
  ShippingRateRequest,
  ShippingRate,
  CreateShipmentRequest,
  ShipmentResult,
  CancelShipmentRequest,
  CreateLabelRequest,
  ShippingLabel,
  TrackingResult,
} from "../interface.js";
import { v4 as uuidv4 } from "uuid";

export class CustomShippingProvider implements ShippingProvider {
  readonly carrierCode = "custom";

  async getRates(request: ShippingRateRequest): Promise<ShippingRate[]> {
    const weight = request.weight ?? 1.0;
    // Standard base 200 PKR + 50 PKR per kg above 1kg
    const standardCost = Math.round(200 + Math.max(0, weight - 1) * 50);
    // Express base 350 PKR + 80 PKR per kg
    const expressCost = Math.round(350 + Math.max(0, weight - 1) * 80);

    // Larekmart Direct Fleet supports domestic COD with a nominal 30 PKR fee
    const isCod = Boolean(request.isCod);
    const codFee = isCod ? 30 : null;

    return [
      {
        id: "custom-standard",
        carrier: this.carrierCode,
        service: "standard",
        name: "Larekmart Standard Delivery",
        amount: standardCost,
        currency: "PKR",
        estimatedDaysMin: 2,
        estimatedDaysMax: 4,
        isCodAvailable: true,
        codFee,
      },
      {
        id: "custom-express",
        carrier: this.carrierCode,
        service: "express",
        name: "Larekmart Express Dispatch",
        amount: expressCost,
        currency: "PKR",
        estimatedDaysMin: 1,
        estimatedDaysMax: 2,
        isCodAvailable: true,
        codFee,
      },
    ];
  }

  async createShipment(
    request: CreateShipmentRequest,
  ): Promise<ShipmentResult> {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const trackingNumber = `LM${randomSuffix}PK`;
    const estimatedDays = request.serviceType === "express" ? 1 : 3;
    const estimatedDeliveryAt = new Date(Date.now() + estimatedDays * 86400000);

    const isCod = Boolean(request.isCod);
    const codFee = isCod ? (request.codFee ?? 30) : null;

    return {
      carrier: this.carrierCode,
      trackingNumber,
      labelUrl: `https://labels.larekmart.com/custom/${trackingNumber}.pdf`,
      estimatedDeliveryAt,
      isCod,
      codAmount: isCod ? request.codAmount : null,
      codFee,
      metadata: {
        provider: "Larekmart Direct Logistics",
        serviceType: request.serviceType,
        destinationCity: request.shippingAddress.city,
        isCod,
        ...(isCod && {
          codCollectionRequired: true,
          amountToCollect: request.codAmount,
          codFee,
          riderInstructions: `Collect PKR ${request.codAmount} in cash from customer and issue electronic SMS receipt.`,
        }),
      },
    };
  }

  async cancelShipment(request: CancelShipmentRequest): Promise<void> {
    // Custom provider cancellation hook
    console.log(
      `[CustomShippingProvider] Shipment ${request.shipmentId} (TRK: ${request.trackingNumber}) cancelled: ${request.reason ?? "No reason"}`,
    );
  }

  async getTracking(trackingNumber: string): Promise<TrackingResult> {
    return {
      shipmentId: "",
      carrier: this.carrierCode,
      trackingNumber,
      status: "IN_TRANSIT",
      estimatedDeliveryAt: new Date(Date.now() + 86400000).toISOString(),
      events: [
        {
          id: uuidv4(),
          shipmentId: "",
          status: "READY_TO_SHIP",
          description: "Package packaged and ready for carrier pickup",
          location: "Lahore Central Fulfillment Center",
          occurredAt: new Date(Date.now() - 3600000).toISOString(),
          source: "carrier_poll",
        },
        {
          id: uuidv4(),
          shipmentId: "",
          status: "IN_TRANSIT",
          description: "Shipment departed originating hub",
          location: "Lahore Sorting Facility",
          occurredAt: new Date().toISOString(),
          source: "carrier_poll",
        },
      ],
      lastUpdated: new Date().toISOString(),
    };
  }

  async createLabel(
    request: CreateLabelRequest & { trackingNumber: string },
  ): Promise<ShippingLabel> {
    return {
      id: uuidv4(),
      shipmentId: request.shipmentId,
      carrier: this.carrierCode,
      trackingNumber: request.trackingNumber,
      format: request.format ?? "pdf",
      labelUrl: `https://labels.larekmart.com/custom/${request.trackingNumber}.${request.format ?? "pdf"}`,
      cost: 0,
      createdAt: new Date().toISOString(),
    };
  }
}
