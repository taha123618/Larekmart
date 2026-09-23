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

export class DhlShippingProvider implements ShippingProvider {
  readonly carrierCode = "dhl";

  async getRates(request: ShippingRateRequest): Promise<ShippingRate[]> {
    const weight = request.weight ?? 1.0;
    // DHL International Express: 3500 base + 1200/kg
    const expressRate = Math.round(3500 + Math.max(0, weight - 1) * 1200);

    return [
      {
        id: "dhl-express-worldwide",
        carrier: this.carrierCode,
        service: "express_worldwide",
        name: "DHL Express Worldwide",
        amount: expressRate,
        currency: "PKR",
        estimatedDaysMin: 3,
        estimatedDaysMax: 5,
        isCodAvailable: false,
        codFee: null,
      },
    ];
  }

  async createShipment(
    request: CreateShipmentRequest,
  ): Promise<ShipmentResult> {
    const awb = `DHL${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    if (request.isCod) {
      console.warn(
        `[DhlShippingProvider] Warning: COD requested for DHL shipment (order: ${request.orderId}), but DHL Express is prepaid only.`,
      );
    }

    return {
      carrier: this.carrierCode,
      trackingNumber: awb,
      labelUrl: `https://xmlpi-ea.dhl.com/v1/labels/${awb}.pdf`,
      estimatedDeliveryAt: new Date(Date.now() + 4 * 86400000),
      isCod: false,
      codAmount: null,
      codFee: null,
      metadata: {
        awbNumber: awb,
        originCountry: "PK",
        destinationCountry: request.shippingAddress.country,
        ...(request.isCod && {
          codWarning:
            "Cash on delivery is not supported for international express courier.",
        }),
      },
    };
  }

  async cancelShipment(request: CancelShipmentRequest): Promise<void> {
    console.log(
      `[DhlShippingProvider] Waybill ${request.trackingNumber} cancelled`,
    );
  }

  async getTracking(trackingNumber: string): Promise<TrackingResult> {
    return {
      shipmentId: "",
      carrier: this.carrierCode,
      trackingNumber,
      status: "IN_TRANSIT",
      estimatedDeliveryAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      events: [
        {
          id: uuidv4(),
          shipmentId: "",
          status: "IN_TRANSIT",
          description: "Shipment has departed from a DHL facility",
          location: "Dubai International Gateway",
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
      labelUrl: `https://xmlpi-ea.dhl.com/v1/labels/${request.trackingNumber}.${request.format ?? "pdf"}`,
      cost: 3500,
      createdAt: new Date().toISOString(),
    };
  }
}
