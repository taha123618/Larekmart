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

export class FedexShippingProvider implements ShippingProvider {
  readonly carrierCode = "fedex";

  async getRates(request: ShippingRateRequest): Promise<ShippingRate[]> {
    const weight = request.weight ?? 1.0;
    // FedEx International Priority: 3800 base + 1100/kg
    const priorityRate = Math.round(3800 + Math.max(0, weight - 1) * 1100);

    return [
      {
        id: "fedex-intl-priority",
        carrier: this.carrierCode,
        service: "international_priority",
        name: "FedEx International Priority",
        amount: priorityRate,
        currency: "PKR",
        estimatedDaysMin: 2,
        estimatedDaysMax: 4,
        isCodAvailable: false,
        codFee: null,
      },
    ];
  }

  async createShipment(
    request: CreateShipmentRequest,
  ): Promise<ShipmentResult> {
    const trackingNumber = `FDX${Math.floor(100000000000 + Math.random() * 900000000000)}`;

    if (request.isCod) {
      console.warn(
        `[FedexShippingProvider] Warning: COD requested for FedEx shipment (order: ${request.orderId}), but FedEx Express is prepaid only.`,
      );
    }

    return {
      carrier: this.carrierCode,
      trackingNumber,
      labelUrl: `https://api.fedex.com/v1/shipments/labels/${trackingNumber}.pdf`,
      estimatedDeliveryAt: new Date(Date.now() + 3 * 86400000),
      isCod: false,
      codAmount: null,
      codFee: null,
      metadata: {
        trackingNumber,
        service: request.serviceType,
        ...(request.isCod && {
          codWarning:
            "Cash on delivery is not supported for FedEx International Express shipments.",
        }),
      },
    };
  }

  async cancelShipment(request: CancelShipmentRequest): Promise<void> {
    console.log(
      `[FedexShippingProvider] Shipment ${request.trackingNumber} cancelled`,
    );
  }

  async getTracking(trackingNumber: string): Promise<TrackingResult> {
    return {
      shipmentId: "",
      carrier: this.carrierCode,
      trackingNumber,
      status: "IN_TRANSIT",
      estimatedDeliveryAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      events: [
        {
          id: uuidv4(),
          shipmentId: "",
          status: "IN_TRANSIT",
          description: "In transit to destination facility",
          location: "Dubai Sorting Hub",
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
      labelUrl: `https://api.fedex.com/v1/shipments/labels/${request.trackingNumber}.${request.format ?? "pdf"}`,
      cost: 3800,
      createdAt: new Date().toISOString(),
    };
  }
}
