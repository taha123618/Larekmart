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

export class TcsShippingProvider implements ShippingProvider {
  readonly carrierCode = "tcs";

  async getRates(request: ShippingRateRequest): Promise<ShippingRate[]> {
    const weight = request.weight ?? 0.5;
    // TCS Express: 250 base, 100/kg
    const expressRate = Math.round(250 + Math.max(0, weight - 0.5) * 100);
    // TCS Overnight: 450 base, 150/kg
    const overnightRate = Math.round(450 + Math.max(0, weight - 0.5) * 150);

    // TCS COD is available across Pakistan. Fee: 1.5% of collection value (min 50 PKR)
    const isCod = Boolean(request.isCod);
    const codFee = isCod
      ? Math.max(50, Math.round((request.codAmount ?? 1000) * 0.015))
      : null;

    return [
      {
        id: "tcs-express",
        carrier: this.carrierCode,
        service: "express",
        name: "TCS Express Economy",
        amount: expressRate,
        currency: "PKR",
        estimatedDaysMin: 2,
        estimatedDaysMax: 3,
        isCodAvailable: true,
        codFee,
      },
      {
        id: "tcs-overnight",
        carrier: this.carrierCode,
        service: "overnight",
        name: "TCS Overnight Courier",
        amount: overnightRate,
        currency: "PKR",
        estimatedDaysMin: 1,
        estimatedDaysMax: 1,
        isCodAvailable: true,
        codFee,
      },
    ];
  }

  async createShipment(
    request: CreateShipmentRequest,
  ): Promise<ShipmentResult> {
    const consignmentNo = `TCS${Math.floor(100000000 + Math.random() * 900000000)}`;
    const isOvernight = request.serviceType === "overnight";
    const estimatedDeliveryAt = new Date(
      Date.now() + (isOvernight ? 1 : 2) * 86400000,
    );

    const isCod = Boolean(request.isCod);
    const codFee = isCod
      ? (request.codFee ??
        Math.max(50, Math.round((request.codAmount ?? 0) * 0.015)))
      : null;

    return {
      carrier: this.carrierCode,
      trackingNumber: consignmentNo,
      labelUrl: `https://api.tcsexpress.com/v1/labels/${consignmentNo}.pdf`,
      estimatedDeliveryAt,
      isCod,
      codAmount: isCod ? request.codAmount : null,
      codFee,
      metadata: {
        consignmentNumber: consignmentNo,
        originCity: "Karachi",
        destinationCity: request.shippingAddress.city,
        service: request.serviceType,
        isCod,
        ...(isCod && {
          consignmentType: "COD",
          codAmountToCollect: request.codAmount,
          codFeeCharged: codFee,
          collectionInstructions: `Collect PKR ${request.codAmount} in cash upon delivery before handing parcel.`,
        }),
      },
    };
  }

  async cancelShipment(request: CancelShipmentRequest): Promise<void> {
    console.log(
      `[TcsShippingProvider] Consignment ${request.trackingNumber} cancelled at TCS dispatch`,
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
          status: "PICKED_UP",
          description: "Shipment booked and picked up from sender",
          location: "TCS Express Center Karachi",
          occurredAt: new Date(Date.now() - 7200000).toISOString(),
          source: "carrier_poll",
        },
        {
          id: uuidv4(),
          shipmentId: "",
          status: "IN_TRANSIT",
          description: "Arrived at TCS Sorting Hub",
          location: "TCS Main Hub Karachi Airport",
          occurredAt: new Date(Date.now() - 3600000).toISOString(),
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
      labelUrl: `https://api.tcsexpress.com/v1/labels/${request.trackingNumber}.${request.format ?? "pdf"}`,
      cost: 250,
      createdAt: new Date().toISOString(),
    };
  }
}
